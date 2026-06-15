"use client";

import { useState, useCallback, type DragEvent } from "react";
import clsx from "clsx";

export function FileDropZone({
  onFiles,
  disabled,
}: {
  onFiles: (files: FileList) => void;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled || !e.dataTransfer.files.length) return;
      onFiles(e.dataTransfer.files);
    },
    [disabled, onFiles],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={clsx(
        "rounded-lg border-2 border-dashed px-6 py-10 text-center transition",
        dragging ? "border-teal-500 bg-teal-500/10" : "border-slate-700 bg-slate-900/30",
        disabled && "opacity-50",
      )}
    >
      <p className="text-sm text-slate-400">
        Drag & drop receipt package here
      </p>
      <p className="mt-1 text-xs text-slate-600">
        .zip, receipt.json + merkle_proof.json + root_signature.json, or full package JSON
      </p>
      <label className="btn-secondary mt-4 inline-block cursor-pointer">
        Browse files
        <input
          type="file"
          className="hidden"
          multiple
          accept=".json,.zip,application/json,application/zip"
          disabled={disabled}
          onChange={(e) => e.target.files && onFiles(e.target.files)}
        />
      </label>
    </div>
  );
}
