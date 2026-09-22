import { fontStack } from "@shared/book-fonts";
import { alignJustify, normalizeColor, pageFill } from "@shared/page-layout";
import { frameClass, frameMarkup } from "@shared/text-frames";
import type { PageLayout } from "@shared/types";

export default function CoverFace({
  layout,
  background,
  font,
  ink,
}: {
  layout: PageLayout;
  background: string;
  font: string;
  ink: string;
}) {
  const fill = pageFill(layout.background, background);
  return (
    <div className="cover-face" style={{ background: fill }}>
      {layout.elements.slice().sort((a, b) => a.z - b.z).map((element) => (
        <div
          key={element.id}
          className={`cover-el${element.type === "text" ? ` ${frameClass(element.frame)}` : ""}`}
          style={{
            left: `${element.x}%`,
            top: `${element.y}%`,
            width: `${element.w}%`,
            height: `${element.h}%`,
            zIndex: element.z,
            ["--frame" as string]: element.type === "text"
              ? (normalizeColor(element.frameColor, "") || ink)
              : undefined,
          }}
        >
          {element.type === "text" && frameMarkup(element.frame, element.w / element.h) ? (
            <span className="cover-frame" dangerouslySetInnerHTML={{ __html: frameMarkup(element.frame, element.w / element.h) }} />
          ) : null}
          {element.type === "image" ? (
            element.imageUrl ? (
              <img src={element.imageUrl} alt="" style={{ objectFit: element.fit === "contain" || element.id === "cover-art" ? "contain" : "cover", opacity: (element.opacity ?? 100) / 100, background: "transparent" }} />
            ) : null
          ) : (
            <div
              className="cover-text"
              style={{
                fontFamily: fontStack(element.fontFamily || font),
                fontSize: `${element.fontSize || 4}cqh`,
                color: normalizeColor(element.color, "") || ink,
                textAlign: element.align || "left",
                alignItems: alignJustify(element.align),
              }}
            >
              {(element.text || "").split(/\n{2,}/).map((para, index) => (
                <p key={index}>
                  {para.split("\n").map((line, lineIndex) => (
                    <span key={lineIndex}>
                      {lineIndex > 0 ? <br /> : null}
                      {line}
                    </span>
                  ))}
                </p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
