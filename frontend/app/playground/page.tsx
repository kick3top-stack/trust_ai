"use client";

import Link from "next/link";
import { useState } from "react";
import { MarkdownContent } from "@/components/MarkdownContent";
import { PageHeader } from "@/components/ui/PageHeader";
import { generateDemo } from "@/lib/api";

const MODELS = [{ id: "qwen2.5-coder-0.5b-instruct", label: "Qwen2.5-Coder-0.5B-Instruct (Q8_0)" }];

export default function PlaygroundPage() {
  const [prompt, setPrompt] = useState(
    "A cinematic cyberpunk city at night with heavy rain and neon reflections...",
  );
  const [model, setModel] = useState(MODELS[0].id);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(128);
  const [topP, setTopP] = useState(0.9);
  const [seed, setSeed] = useState(42);
  const [output, setOutput] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setOutput(null);
    setReceiptId(null);
    try {
      const result = await generateDemo(prompt, {
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        seed,
      });
      setOutput(result.response);
      setReceiptId(result.receipt_id);
      const payload = {
        receipt: result.receipt,
        merkle_proof: result.merkle_proof,
        root_signature: result.root_signature,
        response: result.response,
        receipt_id: result.receipt_id,
      };
      sessionStorage.setItem(`receipt:${result.receipt_id}`, JSON.stringify(payload));
      sessionStorage.setItem(`receipt:request:${result.request_id}`, JSON.stringify(payload));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Playground"
        subtitle="New Generation — run inference and produce a cryptographic receipt"
      />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Left: inputs */}
        <div className="panel">
          <div className="panel-header">Input</div>
          <div className="panel-body space-y-5">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-500">
                Prompt
              </label>
              <textarea
                className="input-field min-h-[140px] resize-y"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your prompt..."
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-500">
                Model
              </label>
              <select className="input-field" value={model} onChange={(e) => setModel(e.target.value)}>
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              <SliderField
                label="Temperature"
                value={temperature}
                min={0}
                max={2}
                step={0.1}
                onChange={setTemperature}
              />
              <SliderField
                label="Max Tokens"
                value={maxTokens}
                min={16}
                max={2048}
                step={16}
                onChange={setMaxTokens}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-xs text-slate-500">Seed</label>
                  <input
                    type="number"
                    className="input-field"
                    value={seed}
                    onChange={(e) => setSeed(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs text-slate-500">Top P</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    className="input-field"
                    value={topP}
                    onChange={(e) => setTopP(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                className="btn-primary flex-1 py-3"
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
              >
                {loading ? "Generating..." : "Generate"}
              </button>
              {receiptId && (
                <Link href={`/receipts/${receiptId}`} className="btn-secondary py-3">
                  View Receipt
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Right: output */}
        <div className="panel flex min-h-[480px] flex-col">
          <div className="panel-header">Generation Output</div>
          <div className="panel-body flex min-h-0 flex-1 flex-col">
            {loading ? (
              <div className="flex flex-1 items-center justify-center text-slate-500">
                <span className="animate-pulse">Running inference...</span>
              </div>
            ) : output ? (
              <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-slate-800 bg-slate-950/40 p-4">
                <MarkdownContent>{output}</MarkdownContent>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-slate-600">
                Output will appear here after generation
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className="font-mono text-slate-400">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-teal-500"
      />
    </div>
  );
}
