"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import {
  bannerGeometry,
  classColor,
  defaultCrop,
  type BannerCrop,
} from "@/lib/class-appearance";
import type { ClassRoom } from "@/lib/model";
import { ClassIcon } from "./class-icon";

export function useBannerUrl(path?: string | null) {
  const [result, setResult] = useState<{ path: string; url: string } | null>(
    null,
  );
  useEffect(() => {
    if (!path || path.startsWith("data:image/jpeg;")) return;
    let mounted = true;
    let expires = 0;
    const refresh = async () => {
      if (expires > Date.now()) return;
      const { data } = await supabase.storage
        .from("class-banners")
        .createSignedUrl(path, 3600);
      if (mounted && data) {
        setResult({ path, url: data.signedUrl });
        expires = Date.now() + 45 * 60 * 1000;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 45 * 60 * 1000);
    window.addEventListener("focus", refresh);
    return () => {
      mounted = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [path]);
  return path?.startsWith("data:image/jpeg;")
    ? path
    : result && result.path === path
      ? result.url
      : null;
}

export function BannerImage({
  src,
  crop = defaultCrop,
}: {
  src: string;
  crop?: BannerCrop;
}) {
  const [size, setSize] = useState({ src: "", width: 0, height: 0 });
  const ready = size.src === src;
  const box = bannerGeometry(
    ready ? size.width : 0,
    ready ? size.height : 0,
    crop,
  );
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      onLoad={(event) =>
        setSize({
          src,
          width: event.currentTarget.naturalWidth,
          height: event.currentTarget.naturalHeight,
        })
      }
      style={{
        position: "absolute",
        maxWidth: "none",
        width: `${box.width / 3}%`,
        height: `${box.height}%`,
        left: `${box.left / 3}%`,
        top: `${box.top}%`,
        opacity: ready ? 1 : 0,
      }}
    />
  );
}

export function ClassCover({
  room,
}: {
  room: Pick<ClassRoom, "color" | "icon" | "banner_path" | "banner_crop">;
}) {
  const src = useBannerUrl(room.banner_path);
  return (
    <div
      className="class-cover class-cover-custom"
      style={{ "--class-color": classColor(room.color) } as CSSProperties}
    >
      {src ? (
        <BannerImage src={src} crop={room.banner_crop} />
      ) : (
        <span className="class-cover-pattern" aria-hidden="true" />
      )}
      <span className="class-symbol">
        <ClassIcon icon={room.icon} />
      </span>
    </div>
  );
}
