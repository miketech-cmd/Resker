import { ImageResponse } from "next/og";

import { getPublicListBySlug } from "@/server/lists";

export const revalidate = 60;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function PublicListOpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const detail = await getPublicListBySlug(slug, null);

  if (!detail) {
    return new ImageResponse(
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          backgroundColor: "#FAF8F5",
          color: "#1F1A17",
          padding: "64px",
          flexDirection: "column",
          justifyContent: "space-between",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, color: "#D9623B", fontWeight: 700 }}>
          RESKER · CURATED RESTAURANT LISTS
        </div>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 600 }}>List not found</div>
        <div style={{ display: "flex", fontSize: 24, color: "#6D645B" }}>resker.vercel.app</div>
      </div>,
      size,
    );
  }

  const { list, items } = detail;
  const curator = list.curatorUsername ? `@${list.curatorUsername}` : list.curatorName || "Resker";
  const spotLabel = `${list.itemCount} ${list.itemCount === 1 ? "spot" : "spots"}`;
  const previewNames = items.slice(0, 4).map((item) => item.name);

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #FAF8F5 0%, #F2ECE3 100%)",
        color: "#1F1A17",
        padding: "56px 64px",
        flexDirection: "column",
        justifyContent: "space-between",
        fontFamily: "Georgia, serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              display: "flex",
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: "#D9623B",
              color: "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            R
          </div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 600, letterSpacing: -0.4 }}>
            Resker
          </div>
        </div>

        <div
          style={{
            display: "flex",
            padding: "10px 20px",
            borderRadius: 999,
            backgroundColor: "#1F1A17",
            color: "#FAF8F5",
            fontSize: 20,
            fontFamily: "sans-serif",
          }}
        >
          {list.city ? `${list.city} · ${spotLabel}` : spotLabel}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 600, lineHeight: 1.08 }}>
          {list.name}
        </div>
        {list.description ? (
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: "#5C544C",
              lineHeight: 1.35,
              fontFamily: "sans-serif",
            }}
          >
            {list.description.slice(0, 120)}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {previewNames.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {previewNames.map((name) => (
              <div
                key={name}
                style={{
                  display: "flex",
                  padding: "10px 18px",
                  borderRadius: 999,
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E5DDD2",
                  fontSize: 21,
                  color: "#1F1A17",
                  fontFamily: "sans-serif",
                }}
              >
                {name}
              </div>
            ))}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            color: "#6D645B",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ display: "flex" }}>Curated by {curator}</div>
          <div style={{ display: "flex", color: "#D9623B", fontWeight: 600 }}>
            Save to your Places →
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
