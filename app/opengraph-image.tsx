import { ImageResponse } from "next/og";

export const alt = "KAV";
export const contentType = "image/png";
export const size = {
  width: 1200,
  height: 630,
};

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#f8fafc",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: 34,
          }}
        >
          <div
            style={{
              color: "#020617",
              fontFamily: "Arial, sans-serif",
              fontSize: 148,
              fontWeight: 800,
              letterSpacing: 0,
              lineHeight: 1,
            }}
          >
            KAV
          </div>
          <div
            style={{
              alignItems: "center",
              background: "#006d99",
              borderRadius: 36,
              boxShadow: "0 26px 60px rgba(0, 109, 153, 0.28)",
              display: "flex",
              height: 148,
              justifyContent: "center",
              position: "relative",
              width: 148,
            }}
          >
            <div
              style={{
                background: "rgba(255, 255, 255, 0.92)",
                borderRadius: 999,
                height: 70,
                position: "absolute",
                right: 48,
                top: 40,
                width: 11,
              }}
            />
            <div
              style={{
                background: "rgba(255, 255, 255, 0.56)",
                borderRadius: 999,
                height: 70,
                position: "absolute",
                right: 69,
                top: 40,
                width: 11,
              }}
            />
            <div
              style={{
                background: "rgba(255, 255, 255, 0.28)",
                borderRadius: 999,
                height: 70,
                position: "absolute",
                right: 90,
                top: 40,
                width: 11,
              }}
            />
          </div>
        </div>
      </div>
    ),
    size,
  );
}
