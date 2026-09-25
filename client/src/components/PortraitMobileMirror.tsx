import type { CSSProperties } from "react";
import { DEFAULT_TEXT_COLOR, fontStack } from "@shared/book-fonts";
import {
  alignJustify,
  elementTextHtml,
  imageObjectFit,
  imageObjectPosition,
  normalizeColor,
  pageFill,
} from "@shared/page-layout";
import { paperSurfaceStyle } from "@shared/paper";
import type { PortraitFlipRole } from "@shared/portrait-pages";
import { mirrorElementSize } from "@shared/portrait-pages";
import { frameClass, frameMarkup } from "@shared/text-frames";
import type { PageElement, PageLayout, PublicBook } from "@shared/types";

function elementStyle(element: PageElement, book: PublicBook): CSSProperties {
  const align = element.align === "center" || element.align === "right" ? element.align : "left";
  const justify = align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";
  const ink = normalizeColor(element.color, "") || book.textColor || DEFAULT_TEXT_COLOR;
  const frame = normalizeColor(element.frameColor, "") || ink;
  return {
    left: `${element.x}%`,
    top: `${element.y}%`,
    width: `${element.w}%`,
    height: `${element.h}%`,
    zIndex: element.z,
    opacity: element.type === "image" || element.type === "shape" ? (element.opacity ?? 100) / 100 : undefined,
    ["--fs" as string]: element.fontSize || 4,
    ["--ff" as string]: fontStack(element.fontFamily || book.textFont),
    ["--ink" as string]: ink,
    ["--frame" as string]: frame,
    ["--ta" as string]: align,
    ["--tj" as string]: justify,
    ["--fit" as string]: imageObjectFit(element),
    ["--focus" as string]: imageObjectPosition(element),
  };
}

function CoverBits({ element, book }: { element: PageElement; book: PublicBook }) {
  const style = elementStyle(element, book);
  const size = mirrorElementSize(element);
  const meta = {
    "data-size": size,
    ...(element.role ? { "data-role": element.role } : {}),
    ...(element.id ? { "data-id": element.id } : {}),
  };
  if (element.type === "shape") {
    return (
      <div
        className="cover-bit cover-bit-shape"
        style={{
          ...style,
          background: normalizeColor(element.color, "") || "#ffffff",
          borderRadius: element.shape === "circle" ? "50%" : "2%",
        }}
        {...meta}
      />
    );
  }
  if (element.type === "image") {
    return element.imageUrl ? <img className="cover-bit cover-bit-image" src={element.imageUrl} alt="" style={style} {...meta} /> : null;
  }
  return (
    <div className={`cover-bit cover-bit-text${frameClass(element.frame) ? ` ${frameClass(element.frame)}` : ""}`} style={style} {...meta}>
      {frameMarkup(element.frame, element.w / element.h) ? (
        <span className="text-frame" dangerouslySetInnerHTML={{ __html: frameMarkup(element.frame, element.w / element.h) }} />
      ) : null}
      <div
        className="cover-text"
        style={{
          fontFamily: fontStack(element.fontFamily || book.textFont),
          fontSize: `${element.fontSize || 4}cqh`,
          color: normalizeColor(element.color, "") || book.textColor || DEFAULT_TEXT_COLOR,
          textAlign: element.align || "left",
          alignItems: alignJustify(element.align),
        }}
        dangerouslySetInnerHTML={{ __html: elementTextHtml(element.text || "", (s) => s) }}
      />
    </div>
  );
}

function LaidOutEl({ element, book }: { element: PageElement; book: PublicBook }) {
  const style = elementStyle(element, book);
  const size = mirrorElementSize(element);
  const meta = {
    "data-size": size,
    ...(element.role ? { "data-role": element.role } : {}),
    ...(element.id ? { "data-id": element.id } : {}),
  };
  if (element.type === "shape") {
    return (
      <div
        className="el el-shape"
        style={{ ...style, background: normalizeColor(element.color, "") || "#ffffff", borderRadius: element.shape === "circle" ? "50%" : "2%" }}
        {...meta}
      />
    );
  }
  if (element.type === "image") {
    return element.imageUrl ? <img className="el el-image" src={element.imageUrl} alt="" style={style} {...meta} /> : null;
  }
  return (
    <div className={`el el-text${frameClass(element.frame) ? ` ${frameClass(element.frame)}` : ""}`} style={style} {...meta}>
      {frameMarkup(element.frame, element.w / element.h) ? (
        <span className="text-frame" dangerouslySetInnerHTML={{ __html: frameMarkup(element.frame, element.w / element.h) }} />
      ) : null}
      <div dangerouslySetInnerHTML={{ __html: elementTextHtml(element.text || "", (s) => s) }} />
    </div>
  );
}

export default function PortraitMobileMirror({
  layout,
  role,
  book,
  width,
  height,
}: {
  layout: PageLayout;
  role: PortraitFlipRole;
  book: PublicBook;
  width: number;
  height: number;
}) {
  const fill = pageFill(layout.background, book.pageBackground);
  const sorted = layout.elements.slice().sort((a, b) => a.z - b.z);
  const surface = paperSurfaceStyle(fill, book.pageTexture);

  if (role === "cover") {
    return (
      <article className="page front-cover portrait-mirror-visual" style={{ ...surface, width, height, position: "relative", backgroundColor: fill }}>
        <div className="front-cover-leaf" style={{ ...surface, backgroundColor: fill, position: "absolute", inset: 0 }}>
          {sorted.map((element) => (
            <CoverBits key={element.id} element={element} book={book} />
          ))}
        </div>
      </article>
    );
  }

  const pageClass = role === "title" ? "page laid-out title-page current" : role === "end" ? "page laid-out end-page current" : "page laid-out current";

  return (
    <article className={`${pageClass} portrait-mirror-visual`} style={{ ...surface, width, height, backgroundColor: fill, position: "relative" }}>
      {sorted.map((element) => (
        <LaidOutEl key={element.id} element={element} book={book} />
      ))}
    </article>
  );
}
