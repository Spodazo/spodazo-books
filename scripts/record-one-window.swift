import AppKit
import AVFoundation
import CoreMedia
import Foundation
import ScreenCaptureKit

final class Recorder: NSObject, SCStreamOutput, SCStreamDelegate {
    let writer: AVAssetWriter
    let input: AVAssetWriterInput
    private let queue = DispatchQueue(label: "rudolph-window-record")
    private var started = false
    private var sessionStarted = false

    init(url: URL, width: Int, height: Int) throws {
        writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
        let settings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: width,
            AVVideoHeightKey: height,
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: 28_000_000,
                AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
            ],
        ]
        input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
        input.expectsMediaDataInRealTime = true
        writer.add(input)
        super.init()
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sample: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen, CMSampleBufferDataIsReady(sample) else { return }
        queue.sync {
            if !started {
                writer.startWriting()
                started = true
            }
            guard input.isReadyForMoreMediaData, writer.status == .writing || !sessionStarted else { return }
            if !sessionStarted {
                writer.startSession(atSourceTime: CMSampleBufferGetPresentationTimeStamp(sample))
                sessionStarted = true
            }
            guard writer.status == .writing else { return }
            input.append(sample)
        }
    }

    func finish() async {
        input.markAsFinished()
        await withCheckedContinuation { (done: CheckedContinuation<Void, Never>) in
            writer.finishWriting { done.resume() }
        }
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
            config.queueDepth = 6
            config.minimumFrameInterval = CMTime(value: 1, timescale: 60)
            config.pixelFormat = kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange
            let recorder = try Recorder(url: url, width: width, height: height)
            let stream = SCStream(filter: filter, configuration: config, delegate: recorder)
            try stream.addStreamOutput(recorder, type: SCStreamOutputType.screen, sampleHandlerQueue: DispatchQueue.global())
            try await stream.startCapture()
            fputs("recording \(width)x\(height) for \(seconds)s\n", stderr)
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
