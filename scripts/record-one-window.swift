import AppKit
import AVFoundation
import CoreMedia
import Foundation
import ScreenCaptureKit

/// Records one window at 60fps.
/// Frames are queued instead of discarded when the encoder is briefly busy.
/// ScreenCaptureKit's own guidance is queueDepth 3...8 and a 1/60 frame interval
/// (WWDC22 session 10155). Dropping on `isReadyForMoreMediaData == false` is what
/// made the page curl jump.
final class Recorder: NSObject, SCStreamOutput, SCStreamDelegate {
    let writer: AVAssetWriter
    let input: AVAssetWriterInput
    private let queue = DispatchQueue(label: "rudolph-window-record")
    private var started = false
    private var sessionStarted = false
    private var expectedWidth = 0
    private var expectedHeight = 0
    private var pending: [CMSampleBuffer] = []
    private var dropped = 0
    private var written = 0
    private let maxPending = 8

    init(url: URL, width: Int, height: Int) throws {
        writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
        let settings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.hevc,
            AVVideoWidthKey: width,
            AVVideoHeightKey: height,
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: 40_000_000,
                AVVideoExpectedSourceFrameRateKey: 60,
                AVVideoMaxKeyFrameIntervalKey: 60,
            ],
        ]
        input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
        input.expectsMediaDataInRealTime = true
        writer.add(input)
        super.init()
        input.addObserver(self, forKeyPath: "readyForMoreMediaData", options: [.new], context: nil)
    }

    override func observeValue(forKeyPath keyPath: String?, of object: Any?, change: [NSKeyValueChangeKey: Any]?, context: UnsafeMutableRawPointer?) {
        guard keyPath == "readyForMoreMediaData" else { return }
        queue.async { self.drain() }
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sample: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen, CMSampleBufferDataIsReady(sample) else { return }
        if let attachments = CMSampleBufferGetSampleAttachmentsArray(sample, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]],
           let raw = attachments.first?[.status] as? Int,
           let status = SCFrameStatus(rawValue: raw),
           status != .complete {
            return
        }
        queue.async { self.enqueue(sample) }
    }

    private func enqueue(_ sample: CMSampleBuffer) {
        let time = CMSampleBufferGetPresentationTimeStamp(sample)
        guard time.isValid, time.isNumeric else { return }
        guard let image = CMSampleBufferGetImageBuffer(sample) else { return }
        let pixelWidth = CVPixelBufferGetWidth(image)
        let pixelHeight = CVPixelBufferGetHeight(image)
        if sessionStarted, pixelWidth != expectedWidth || pixelHeight != expectedHeight { return }
        if !started {
            writer.startWriting()
            started = true
        }
        guard writer.status == .writing else { return }
        if !sessionStarted {
            expectedWidth = pixelWidth
            expectedHeight = pixelHeight
            writer.startSession(atSourceTime: time)
            sessionStarted = true
        }
        if pending.count >= maxPending {
            pending.removeFirst()
            dropped += 1
        }
        pending.append(sample)
        drain()
    }

    private func drain() {
        while input.isReadyForMoreMediaData, !pending.isEmpty {
            let sample = pending.removeFirst()
            if input.append(sample) {
                written += 1
            } else {
                fputs("append failed \(writer.error?.localizedDescription ?? "")\n", stderr)
                break
            }
        }
    }

    func finish() async {
        await withCheckedContinuation { (done: CheckedContinuation<Void, Never>) in
            queue.async {
                self.drain()
                self.input.markAsFinished()
                self.writer.finishWriting {
                    fputs("frames written \(self.written) dropped \(self.dropped)\n", stderr)
                    done.resume()
                }
            }
        }
        input.removeObserver(self, forKeyPath: "readyForMoreMediaData")
    }
}

func record() async {
    let args = CommandLine.arguments
    guard args.count == 4, let pid = pid_t(args[1]), let seconds = Double(args[2]), seconds > 0 else {
        fputs("usage: record-one-window <chrome-pid> <seconds> <outfile.mp4>\n", stderr)
        exit(2)
    }
    let url = URL(fileURLWithPath: args[3])
    do {
        if FileManager.default.fileExists(atPath: url.path) {
            try FileManager.default.removeItem(at: url)
        }
        fputs("listing windows\n", stderr)
        fflush(stderr)
        var window: SCWindow?
        let deadline = Date().addingTimeInterval(20)
        while Date() < deadline {
            let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
            window = content.windows.first(where: { item in
                let sameApp = item.owningApplication?.processID == pid
                let tall = item.frame.height > 200
                let title = item.title ?? ""
                let titled = title == "Spodazo Books" || title.contains("Rudolph")
                return sameApp && tall && titled
            })
            if window != nil { break }
            try await Task.sleep(nanoseconds: 300_000_000)
        }
        guard let window else {
            fputs("Rudolph window for pid \(pid) not found\n", stderr)
            exit(1)
        }
        let filter = SCContentFilter(desktopIndependentWindow: window)
        let scale = CGFloat(max(1, filter.pointPixelScale))
        var width = Int((window.frame.width * scale).rounded())
        var height = Int((window.frame.height * scale).rounded())
        width -= width % 2
        height -= height % 2
        let config = SCStreamConfiguration()
        config.width = width
        config.height = height
        config.showsCursor = false
        config.capturesAudio = false
        config.queueDepth = 8
        config.minimumFrameInterval = CMTime(value: 1, timescale: 60)
        config.pixelFormat = kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange
        let recorder = try Recorder(url: url, width: width, height: height)
        let stream = SCStream(filter: filter, configuration: config, delegate: recorder)
        try stream.addStreamOutput(recorder, type: SCStreamOutputType.screen, sampleHandlerQueue: DispatchQueue(label: "rudolph-samples"))
        try await stream.startCapture()
        fputs("recording \(width)x\(height) at 60fps for \(seconds)s\n", stderr)
        try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
        try await stream.stopCapture()
        await recorder.finish()
        if recorder.writer.status != AVAssetWriter.Status.completed {
            fputs("writer \(recorder.writer.status.rawValue) \(recorder.writer.error?.localizedDescription ?? "")\n", stderr)
            exit(1)
        }
        fputs("wrote \(url.path)\n", stderr)
    } catch {
        fputs("\(error)\n", stderr)
        exit(1)
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
Task { @MainActor in
    await record()
    app.terminate(nil)
}
app.run()
