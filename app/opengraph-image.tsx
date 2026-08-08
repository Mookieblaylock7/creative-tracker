import { ImageResponse } from "next/og";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const alt = "My Film People";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const svgPath = path.join(process.cwd(), "app", "icon.svg");
  let base64Svg = "";
  if (fs.existsSync(svgPath)) {
    const svgData = fs.readFileSync(svgPath, "utf8");
    base64Svg = "data:image/svg+xml;base64," + Buffer.from(svgData).toString("base64");
  }

  return new ImageResponse(
    (
      <div
        style={{
          background: "#0d1117",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          border: "12px solid #30363d",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "160px",
            height: "160px",
            borderRadius: "32px",
            background: "#161b22",
            border: "2px solid #30363d",
            marginBottom: "28px",
            overflow: "hidden",
            padding: "20px",
          }}
        >
          {base64Svg ? (
            <img src={base64Svg} width="120" height="120" alt="My Film People Logo" />
          ) : null}
        </div>
        <div
          style={{
            fontSize: "64px",
            fontWeight: "bold",
            color: "#ffffff",
            letterSpacing: "-2px",
            marginBottom: "16px",
          }}
        >
          MY FILM PEOPLE
        </div>
        <div
          style={{
            fontSize: "24px",
            color: "#8b949e",
            maxWidth: "800px",
            textAlign: "center",
          }}
        >
          Track upcoming movies, TV shows, and docs from your favorite film industry creatives.
        </div>
      </div>
    ),
    { ...size }
  );
}
