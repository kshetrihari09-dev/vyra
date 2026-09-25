import React, { useRef, useState } from "react";
import { useS } from "./tokens.js";
import { Icon } from "../../components/shared/Icon.jsx";
import { TONE } from "../../theme.js";

const MAX_SIDE = 720;
const MAX_FILES = 5;

/** Downscale in the browser so a phone photo doesn't bloat the in-memory catalogue. */
export function shrink(file, max = MAX_SIDE) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("That file isn't a readable image."));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function ImageUploader({ images = [], onChange }) {
  const s = useS();
  const input = useRef(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async (fileList) => {
    setError("");
    const files = [...fileList].slice(0, MAX_FILES - images.length);
    if (!files.length) { setError(`You can add up to ${MAX_FILES} images.`); return; }
    setBusy(true);
    try {
      const bad = files.find((f) => !f.type.startsWith("image/") || f.size > 8 * 1024 * 1024);
      if (bad) throw new Error(bad.type.startsWith("image/") ? "Images must be under 8 MB." : "Only image files can be uploaded.");
      const next = await Promise.all(files.map((f) => shrink(f)));
      onChange([...images, ...next]);
    } catch (e) { setError(e.message); } finally { setBusy(false); if (input.current) input.current.value = ""; }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2.5">
        {images.map((src, i) => (
          <div key={i} className="relative w-20 h-20 overflow-hidden" style={{ borderRadius: s.r, border: `1px solid ${s.line}` }}>
            <img src={src} alt={`Product image ${i + 1}`} className="w-full h-full object-cover" />
            {i === 0 && <span className="absolute left-1 bottom-1 text-[10px] font-semibold px-1.5 rounded" style={{ background: "rgba(16,32,42,.75)", color: "#fff" }}>Main</span>}
            <button type="button" aria-label={`Remove image ${i + 1}`} onClick={() => onChange(images.filter((_, j) => j !== i))}
              className="absolute right-1 top-1 w-5 h-5 rounded-full inline-flex items-center justify-center" style={{ background: "rgba(16,32,42,.75)", color: "#fff" }}>
              <Icon name="X" size={11} />
            </button>
          </div>
        ))}
        {images.length < MAX_FILES && (
          <button type="button" onClick={() => input.current?.click()} disabled={busy}
            className="w-20 h-20 flex flex-col items-center justify-center gap-1 text-xs font-medium" style={{ border: `1.5px dashed ${s.line}`, borderRadius: s.r, color: s.muted }}>
            <Icon name={busy ? "Loader2" : "Upload"} size={16} className={busy ? "animate-spin" : ""} />
            {busy ? "Adding" : "Add"}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => add(e.target.files)} />
      <p className="text-xs mt-2" style={{ color: error ? TONE.danger : s.muted }}>{error || "Up to 5 images. The first is shown on product cards."}</p>
    </div>
  );
}
