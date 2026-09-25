import type { CSSProperties, ReactNode } from "react";
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

function mirrorClass(role: PortraitFlipRole): string {
  if (role === "cover") return "portrait-mobile-mirror front-cover-leaf";
  const extra = role === "title" ? " title-page" : role === "end" ? " end-page" : "";
  return `portrait-mobile-mirror laid-out current${extra}`;
}

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

function MirrorElement({
  element,
  book,
  role,
  children,
}: {
  element: PageElement;
  book: PublicBook;
  role: PortraitFlipRole;
  children?: ReactNode;
}) {
  const size = mirrorElementSize(element);
  const style = elementStyle(element, book);
  const meta = {
    "data-size": size,
    ...(element.role ? { "data-role": element.role } : {}),
    ...(element.id ? { "data-id": element.id } : {}),
  };

  if (role === "cover") {
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
        >
          {children}
        </div>
      );
    }
    if (element.type === "image") {
      return element.imageUrl ? (
        <>
          <img className="cover-bit cover-bit-image" src={element.imageUrl} alt="" style={style} {...meta} />
          {children}
        </>
      ) : null;
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
        {children}
      </div>
    );
  }

  if (element.type === "shape") {
    return (
      <div
        className="el el-shape"
        style={{ ...style, background: normalizeColor(element.color, "") || "#ffffff", borderRadius: element.shape === "circle" ? "50%" : "2%" }}
        {...meta}
      >
        {children}
      </div>
    );
  }
  if (element.type === "image") {
    return element.imageUrl ? (
      <>
        <img className="el el-image" src={element.imageUrl} alt="" style={style} {...meta} />
        {children}
      </>
    ) : null;
  }
  return (
    <div className={`el el-text${frameClass(element.frame) ? ` ${frameClass(element.frame)}` : ""}`} style={style} {...meta}>
      {frameMarkup(element.frame, element.w / element.h) ? (
        <span className="text-frame" dangerouslySetInnerHTML={{ __html: frameMarkup(element.frame, element.w / element.h) }} />
      ) : null}
      <div
        dangerouslySetInnerHTML={{ __html: elementTextHtml(element.text || "", (s) => s) }}
      />
      {children}
    </div>
  );
}

export default function PortraitMobileMirror({
  layout,
  role,
  book,
  width,
  height,
  renderElementOverlay,
}: {
  layout: PageLayout;
  role: PortraitFlipRole;
  book: PublicBook;
  width: number;
  height: number;
  renderElementOverlay?: (element: PageElement) => ReactNode;
}) {
  const fill = pageFill(layout.background, book.pageBackground);
  const sorted = layout.elements.slice().sort((a, b) => a.z - b.z);

  return (
    <div
      className={mirrorClass(role)}
      style={{ ...paperSurfaceStyle(fill, book.pageTexture), width, height, backgroundColor: fill }}
    >
      {sorted.map((element) => (
        <MirrorElement key={element.id} element={element} book={book} role={role}>
          {renderElementOverlay?.(element)}
        </MirrorElement>
      ))}
      {role === "end" ? <footer className="end-legal portrait-mirror-legal" aria-hidden="true" /> : null}
    </div>
  );
}
