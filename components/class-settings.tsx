"use client";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  classColors,
  classColor,
  defaultCrop,
  bannerGeometry,
  clamp,
  prepareBanner,
  type BannerCrop,
} from "@/lib/class-appearance";
import type { ClassRoom } from "@/lib/model";
import { ClassIcon, ClassIconPicker } from "./class-icon";
import { BannerImage, useBannerUrl } from "./class-cover";
import { Check, Upload, Trash2, Loader2 } from "./animated-icons";
import { Field } from "./workspace-ui";

export type BannerDraft = {
  file: Blob | null;
  path: string | null;
  crop: BannerCrop;
};
export default function ClassSettings({
  room,
  busy,
  onSave,
  onCancel,
  children,
}: {
  room?: ClassRoom;
  busy: boolean;
  onSave: (
    fields: Record<string, FormDataEntryValue>,
    banner: BannerDraft,
  ) => Promise<void>;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const [color, setColor] = useState(room?.color ?? "sage");
  const [icon, setIcon] = useState<NonNullable<ClassRoom["icon"]>>(
    room?.icon ?? "book",
  );
  const [crop, setCrop] = useState(room?.banner_crop ?? { ...defaultCrop });
  const [path, setPath] = useState(room?.banner_path ?? null);
  const [file, setFile] = useState<Blob | null>(null),
    [localUrl, setLocalUrl] = useState("");
  const [processing, setProcessing] = useState(false),
    [error, setError] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const existingUrl = useBannerUrl(path),
    src = localUrl || existingUrl;
  const request = useRef(0),
    fileInput = useRef<HTMLInputElement>(null);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    crop: BannerCrop;
    width: number;
  } | null>(null);
  useEffect(() => {
    if (!file) {
      setLocalUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    let mounted = true;
    setSize({ width: 0, height: 0 });
    if (src) {
      const image = new Image();
      image.onload = () => {
        if (mounted)
          setSize({ width: image.naturalWidth, height: image.naturalHeight });
      };
      image.src = src;
    }
    return () => {
      mounted = false;
    };
  }, [src]);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  async function choosePhoto(photo?: File) {
    if (!photo) return;
    const version = ++request.current;
    setProcessing(true);
    setError("");
    try {
      const prepared = await prepareBanner(photo);
      if (version !== request.current) return;
      setFile(prepared);
      setCrop({ ...defaultCrop });
      setAdjusting(true);
    } catch (err) {
      if (version === request.current)
        setError(
          err instanceof Error ? err.message : "Não foi possível abrir a foto.",
        );
    } finally {
      if (version === request.current) setProcessing(false);
    }
  }
  const box = bannerGeometry(size.width, size.height, crop);
  return (
    <form
      className="class-settings"
      onSubmit={(event) => {
        event.preventDefault();
        if (!processing && !busy)
          void onSave(Object.fromEntries(new FormData(event.currentTarget)), {
            file,
            path,
            crop,
          });
      }}
    >
      <fieldset disabled={busy || processing} className="class-settings-fields">
        <div className="class-settings-intro">
          <p>Deixe a turma fácil de reconhecer.</p>
          <span>Veja as mudanças na prévia e salve quando estiver pronto.</span>
        </div>
        <div
          className={`class-appearance-preview ${adjusting && src ? "is-cropping" : ""}`}
          style={{ "--class-color": classColor(color) } as CSSProperties}
        >
          <div
            className="class-cover class-cover-custom"
            aria-label={
              adjusting
                ? "Prévia do recorte. Arraste a foto ou use os controles de posição."
                : "Prévia da aparência da turma"
            }
            onPointerDown={(event) => {
              if (!adjusting || !src || busy || processing) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = {
                id: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                crop,
                width: event.currentTarget.clientWidth,
              };
            }}
            onPointerMove={(event) => {
              const origin = drag.current;
              if (!origin || origin.id !== event.pointerId) return;
              const geometry = bannerGeometry(
                size.width,
                size.height,
                origin.crop,
                origin.width,
              );
              setCrop({
                ...origin.crop,
                x: geometry.overflowX
                  ? clamp(
                      origin.crop.x -
                        (event.clientX - origin.x) / geometry.overflowX,
                      0,
                      1,
                    )
                  : 0.5,
                y: geometry.overflowY
                  ? clamp(
                      origin.crop.y -
                        (event.clientY - origin.y) / geometry.overflowY,
                      0,
                      1,
                    )
                  : 0.5,
              });
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onLostPointerCapture={() => {
              drag.current = null;
            }}
          >
            {src ? (
              <BannerImage src={src} crop={crop} />
            ) : (
              <span className="class-cover-pattern" aria-hidden="true" />
            )}
            <span className="class-symbol">
              <ClassIcon icon={icon} />
            </span>
          </div>
          <div className="appearance-caption">
            <strong>Prévia da turma</strong>
            <span>
              {classColors.find((item) => item.value === color)?.label} ·{" "}
              {src ? "Com foto" : "Sem foto"}
            </span>
          </div>
        </div>
        <div className="banner-actions">
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="visually-hidden"
            tabIndex={-1}
            aria-label="Selecionar foto do banner"
            onChange={(event) => {
              void choosePhoto(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className="button secondary"
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={16} />
            {path || file ? "Trocar foto" : "Adicionar foto"}
          </button>
          {!!src && (
            <button
              type="button"
              className="button secondary"
              onClick={() => setAdjusting(!adjusting)}
            >
              {adjusting ? "Concluir recorte" : "Ajustar recorte"}
            </button>
          )}
          {!!(path || file) && (
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setFile(null);
                setPath(null);
                setCrop({ ...defaultCrop });
                setAdjusting(false);
                setError("");
              }}
            >
              <Trash2 size={16} />
              Remover foto
            </button>
          )}
        </div>
        <p className="helper-note">
          Foto opcional · JPG, PNG ou WebP, até 10 MB. A cor e o ícone continuam
          visíveis com a foto.
        </p>
        {!!src && adjusting && (
          <div className="banner-crop-controls">
            <p>Arraste a foto para enquadrar ou use os controles abaixo.</p>
            <label>
              Zoom <output>{Math.round(crop.zoom * 100)}%</output>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={crop.zoom}
                onChange={(event) =>
                  setCrop({ ...crop, zoom: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Posição horizontal
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                disabled={box.overflowX < 1}
                value={crop.x}
                onChange={(event) =>
                  setCrop({ ...crop, x: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Posição vertical
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                disabled={box.overflowY < 1}
                value={crop.y}
                onChange={(event) =>
                  setCrop({ ...crop, y: Number(event.target.value) })
                }
              />
            </label>
            <button
              type="button"
              className="text-button"
              onClick={() => setCrop({ ...defaultCrop })}
            >
              Restaurar enquadramento
            </button>
          </div>
        )}
        <fieldset className="class-color-picker">
          <legend>Cor da turma</legend>
          <div>
            {classColors.map((item) => (
              <label
                key={item.value}
                title={item.label}
                style={{ "--swatch-color": item.hex } as CSSProperties}
              >
                <input
                  type="radio"
                  name="color"
                  value={item.value}
                  checked={color === item.value}
                  onChange={() => setColor(item.value)}
                />
                <span className="color-swatch">
                  {color === item.value && <Check size={18} />}
                </span>
                <span className="visually-hidden">{item.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <ClassIconPicker value={icon} onChange={setIcon} />
        <section className="class-details-fields">
          <h3>Informações da turma</h3>
          <Field label="Nome da turma">
            <input
              name="name"
              defaultValue={room?.name ?? ""}
              placeholder="Ex.: 7º ano A"
              required
              minLength={2}
              maxLength={80}
            />
          </Field>
          <div className="form-grid">
            <Field label="Série / etapa">
              <input
                name="grade"
                defaultValue={room?.grade ?? ""}
                placeholder="Ex.: 7º ano"
                required
                maxLength={80}
              />
            </Field>
            <Field label="Matéria">
              <input
                name="subject"
                defaultValue={room?.subject ?? ""}
                placeholder="Ex.: Matemática"
                required
                minLength={2}
                maxLength={80}
              />
            </Field>
            <Field label="Turno">
              <input
                name="period"
                defaultValue={room?.period ?? ""}
                placeholder="Ex.: Manhã"
                maxLength={40}
              />
            </Field>
          </div>
        </section>
      </fieldset>
      {processing && (
        <p role="status" className="helper-note">
          <Loader2 size={16} className="spin" /> Preparando foto…
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="dialog-actions class-settings-save">
        <button
          type="button"
          className="button secondary"
          onClick={onCancel}
          disabled={busy}
        >
          Cancelar
        </button>
        <button className="button primary" disabled={busy || processing}>
          {busy ? "Salvando…" : room ? "Salvar alterações" : "Criar turma"}
          <Check size={17} />
        </button>
      </div>
      {children}
    </form>
  );
}
