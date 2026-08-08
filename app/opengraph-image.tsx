import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "My Film People";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
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
          border: "8px solid #30363d",
        }}
      >
        {/* Main Logo Container */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 120,
            height: 120,
            borderRadius: 24,
            background: "#161b22",
            border: "2px solid #58a6ff",
            marginBottom: 28,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#58a6ff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
            <line x1="7" y1="2" x2="7" y2="22" />
            <line x1="17" y1="2" x2="17" y2="22" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <line x1="2" y1="7" x2="7" y2="7" />
            <line x1="2" y1="17" x2="7" y2="17" />
            <line x1="17" y1="17" x2="22" y2="17" />
            <line x1="17" y1="7" x2="22" y2="7" />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 58,
            fontWeight: 900,
            color: "#ffffff",
            letterSpacing: "-1px",
            marginBottom: 12,
          }}
        >
          MY FILM PEOPLE
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 22,
            color: "#8b949e",
            maxWidth: 700,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          Track upcoming movies, TV shows, and docs from your favorite film industry creatives.
        </div>
      </div>
    ),
    { ...size }
  );
}
