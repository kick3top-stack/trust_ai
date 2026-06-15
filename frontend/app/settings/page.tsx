"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchPublicKey } from "@/lib/api";
import { showInfo } from "@/lib/sweetAlert";

export default function SettingsPage() {
  const [publicKey, setPublicKey] = useState<string>("");
  const [keyId, setKeyId] = useState<string>("");
  const [options, setOptions] = useState({
    signAuto: true,
    merkleBatch: true,
    exportJson: true,
    exportPdf: false,
    verifyBeforeDownload: true,
  });

  useEffect(() => {
    fetchPublicKey()
      .then((k) => {
        setPublicKey(k.public_key);
        setKeyId(k.signing_key_id);
      })
      .catch(() => setPublicKey("unavailable"));
  }, []);

  return (
    <div>
      <PageHeader title="Settings" subtitle="Platform configuration" />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="panel">
          <div className="panel-header">Receipt Options</div>
          <div className="panel-body space-y-4">
            {(
              [
                ["signAuto", "Sign receipts automatically"],
                ["merkleBatch", "Enable Merkle batching"],
                ["exportJson", "Export JSON"],
                ["exportPdf", "Export PDF (coming soon)"],
                ["verifyBeforeDownload", "Verify before download"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-center gap-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={options[key]}
                  onChange={(e) => setOptions((o) => ({ ...o, [key]: e.target.checked }))}
                  className="rounded border-slate-600 bg-slate-800 text-teal-500"
                  disabled={key === "exportPdf"}
                />
                {label}
              </label>
            ))}
            <button className="btn-primary mt-2" onClick={() => showInfo("Settings saved", "Your preferences were saved locally (MVP).")}>
              Save
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">Signing Key</div>
          <div className="panel-body space-y-4">
            <p className="text-xs text-slate-500">Key ID: {keyId || "—"}</p>
            <div className="input-field font-mono text-xs">
              ed25519: {publicKey ? `${publicKey.slice(0, 24)}${"*".repeat(24)}` : "loading..."}
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary" onClick={() => showInfo("Key rotation", "Key rotation is documented in docs/signatures.md")}>
                Rotate Key
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
