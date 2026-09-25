import React, { useRef, useState } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Upload, FileText, X, Loader2 } from "./Icon.jsx";
import { MAX_UPLOAD_MB, ACCEPTED_FILE_TYPES } from "../../data/documentTypes.js";
import { TONE } from "../../theme.js";

/**
 * This app has no server, so "secure storage" here means: validate type/size
 * client-side, keep the file as a data URL in memory (never written anywhere
 * public), and never render it outside an authorized view. A real deployment
 * would swap this for an upload to private object storage behind signed URLs
 * — the validation and status model here is written to drop into that
 * unchanged.
 */
export function FileUpload({ label, value, onChange, required }) {
  const { toast } = useApp();
  const C = useC();
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const pick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) { toast("Only JPG, PNG or PDF files are accepted", "danger"); return; }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) { toast(`File must be under ${MAX_UPLOAD_MB}MB`, "danger"); return; }
    setBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      setBusy(false);
      onChange({ fileName: file.name, fileUrl: reader.result, uploadedAt: new Date().toISOString(), verificationStatus: "pending" });
    };
    reader.onerror = () => { setBusy(false); toast("Couldn't read that file — try again", "danger"); };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{label}{required && " *"}</label>
      <input ref={inputRef} type="file" accept={ACCEPTED_FILE_TYPES.join(",")} onChange={pick} className="hidden" />
      {value ? (
        <div className="mt-1 rounded-xl p-3 flex items-center gap-3" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.mint }}>
            <FileText size={16} style={{ color: C.primary }} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold truncate" style={{ color: C.navy }}>{value.fileName}</span>
            <span className="block text-[11px]" style={{ color: value.verificationStatus === "rejected" ? TONE.danger : C.muted }}>
              {value.verificationStatus === "verified" ? "Verified" : value.verificationStatus === "rejected" ? (value.rejectionReason || "Rejected — re-upload") : "Uploaded, pending review"}
            </span>
          </span>
          <button aria-label="Replace file" onClick={() => inputRef.current?.click()} className="text-[11px] font-bold px-2" style={{ color: C.primary }}>Replace</button>
          <button aria-label="Remove file" onClick={() => onChange(null)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: TONE.dangerBg }}>
            <X size={13} style={{ color: TONE.danger }} />
          </button>
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} disabled={busy}
          className="w-full mt-1 rounded-xl p-3 flex items-center justify-center gap-2 text-sm font-semibold"
          style={{ background: C.bg, border: `1.5px dashed ${C.border}`, color: C.muted }}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          {busy ? "Uploading…" : "Choose file (JPG, PNG or PDF, max 5MB)"}
        </button>
      )}
    </div>
  );
}
