export const classColors = [
  { value: "sage", label: "Verde", hex: "#167d60" },
  { value: "peach", label: "Laranja", hex: "#bd5427" },
  { value: "blue", label: "Azul", hex: "#2563eb" },
  { value: "lilac", label: "Violeta", hex: "#7838cf" },
  { value: "rose", label: "Rosa", hex: "#bd3471" },
  { value: "amber", label: "Dourado", hex: "#996509" },
  { value: "teal", label: "Turquesa", hex: "#087e8b" },
  { value: "indigo", label: "Índigo", hex: "#4c44bd" },
  { value: "coral", label: "Coral", hex: "#c13f42" },
  { value: "slate", label: "Grafite", hex: "#435369" },
] as const;
export const classColorValues = [
  "sage",
  "peach",
  "blue",
  "lilac",
  "rose",
  "amber",
  "teal",
  "indigo",
  "coral",
  "slate",
] as const;
export const classIconValues = [
  "book",
  "users",
  "graduation",
  "science",
  "sparkles",
  "pencil",
  "activity",
  "geometry",
  "projects",
  "time",
] as const;
export type BannerCrop = { x: number; y: number; zoom: number };
export const defaultCrop: BannerCrop = { x: 0.5, y: 0.5, zoom: 1 };
export const classColor = (value: string) =>
  (classColors.find((color) => color.value === value) ?? classColors[0]).hex;
export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

// A mesma janela de 3:1 é usada no editor, no cartão e na página da turma.
export function bannerGeometry(
  width: number,
  height: number,
  crop: BannerCrop,
  viewport = 300,
) {
  const frameHeight = viewport / 3;
  if (width <= 0 || height <= 0 || !Number.isFinite(width + height))
    return {
      width: viewport,
      height: frameHeight,
      left: 0,
      top: 0,
      overflowX: 0,
      overflowY: 0,
    };
  const scale =
    Math.max(viewport / width, frameHeight / height) * clamp(crop.zoom, 1, 3);
  const w = width * scale,
    h = height * scale,
    overflowX = Math.max(0, w - viewport),
    overflowY = Math.max(0, h - frameHeight);
  return {
    width: w,
    height: h,
    left: -overflowX * clamp(crop.x, 0, 1),
    top: -overflowY * clamp(crop.y, 0, 1),
    overflowX,
    overflowY,
  };
}

export async function prepareBanner(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Escolha uma foto JPG, PNG ou WebP.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Escolha uma foto de até 10 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 40000000
    )
      throw new Error(
        "A imagem é muito grande. Escolha uma foto com até 40 megapixels.",
      );
    const scale = Math.min(
      1,
      1920 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx)
      throw new Error("Não foi possível preparar a foto neste navegador.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("Não foi possível preparar a foto.")),
        "image/jpeg",
        0.85,
      ),
    );
  } catch (error) {
    if (error instanceof DOMException)
      throw new Error(
        "Não foi possível abrir a imagem. Escolha outro arquivo.",
      );
    throw error;
  } finally {
    URL.revokeObjectURL(url);
  }
}
