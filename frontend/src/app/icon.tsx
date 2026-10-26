import { ImageResponse } from "next/og";

// Everything sits inside the middle 80%, the part Android keeps when it crops an icon to a circle.

// ImageResponse takes literal colours, not CSS variables: these mirror globals.css.
const PAPER = "#f3f5f7";
const INK = "#1c2840";
const INK_MUTED = "#556078";
const HIGHLIGHT = "#f4e64f";

const SIZES = [192, 512];

export function generateImageMetadata() {
  return SIZES.map((size) => ({ id: String(size), size: { width: size, height: size }, contentType: "image/png" }));
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const size = Number(await id);
  const unit = size / 100;
  const line = (width: number, color: string, height: number) => (
    <div style={{ width: width * unit, height: height * unit, background: color, borderRadius: height * unit }} />
  );

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: PAPER, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 * unit, width: 60 * unit }}>
          {line(42, INK_MUTED, 6)}
          <div style={{ display: "flex", position: "relative", height: 8 * unit }}>
            <div
              style={{
                position: "absolute",
                left: -5 * unit,
                top: -1 * unit,
                width: 66 * unit,
                height: 13 * unit,
                background: HIGHLIGHT,
                transform: "rotate(-3deg)",
              }}
            />
            <div style={{ position: "absolute", width: 56 * unit, height: 8 * unit, background: INK, borderRadius: 4 * unit }} />
          </div>
          {line(32, INK_MUTED, 6)}
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
