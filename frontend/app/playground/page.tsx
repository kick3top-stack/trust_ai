"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { MarkdownContent } from "@/components/MarkdownContent";
import { PageHeader } from "@/components/ui/PageHeader";
import { generateDemoStream } from "@/lib/generateStream";
import type { GenerateDemoResponse } from "@/lib/api";
import { estimateMaxCredits } from "@/lib/api";
import { fetchBillingConfig } from "@/lib/credits";

const MODELS = [{ id: "qwen2.5-coder-0.5b-instruct", label: "Qwen2.5-Coder-0.5B-Instruct (Q8_0)" }];

export default function PlaygroundPage() {
  const { user, refreshUser } = useAuth();
  const [prompt, setPrompt] = useState(
    "",
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
  const [chargeSummary, setChargeSummary] = useState<string | null>(null);
  const [creditRate, setCreditRate] = useState(0.01);

  useEffect(() => {
    fetchBillingConfig()
      .then((c) => setCreditRate(c.credit_rate))
      .catch(() => {});
  }, []);

  const estimatedCredits = estimateMaxCredits(maxTokens, prompt, creditRate);

  function storeReceipt(result: GenerateDemoResponse) {
    const payload = {
      receipt: result.receipt,
      merkle_proof: result.merkle_proof,
      root_signature: result.root_signature,
      response: result.response,
      receipt_id: result.receipt_id,
      generation: {
        prompt_text: prompt,
        response_text: result.response,
        prompt_tokens: result.prompt_tokens,
        completion_tokens: result.completion_tokens,
        credit_cost: result.credit_cost,
        model_name: String(result.receipt.model_name || model),
        created_at: String(result.receipt.timestamp || new Date().toISOString()),
      },
    };
    sessionStorage.setItem(`receipt:${result.receipt_id}`, JSON.stringify(payload));
    sessionStorage.setItem(`receipt:request:${result.request_id}`, JSON.stringify(payload));
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setChargeSummary(null);
    setOutput("");
    setReceiptId(null);
    try {
      await generateDemoStream(
        prompt,
        {
          temperature,
          max_tokens: maxTokens,
          top_p: topP,
          seed,
        },
        {
          onToken: (text) => {
            setOutput((prev) => `${prev ?? ""}${text}`);
          },
          onDone: async (result) => {
            setOutput(result.response);
            setReceiptId(result.receipt_id);
            setChargeSummary(
              `Charged ${result.credit_cost} credits (${result.prompt_tokens + result.completion_tokens} tokens) · Balance ${result.credit_balance}`,
            );
            storeReceipt(result);
            await refreshUser();
          },
          onError: (message) => {
            setError(message);
          },
        },
      );
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
        subtitle="New Generation: run inference and get a receipt for every charge"
      />

      {user && (
        <p className="mb-4 text-sm text-slate-500">
          Credit balance:{" "}
          <span className="font-mono text-teal-400">{user.credit_balance ?? "-"}</span>
          {" · "}
          Estimated cost: up to ~{estimatedCredits} credits (prompt + max output)
          {" · "}
          <Link href="/billing" className="text-teal-400 hover:underline">
            Billing
          </Link>
        </p>
      )}

      {chargeSummary && (
        <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {chargeSummary}
          {receiptId && (
            <>
              {" · "}
              <Link href={`/receipts/${receiptId}`} className="underline">
                View receipt
              </Link>
            </>
          )}
        </div>
      )}

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
            {loading || output ? (
              <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-slate-800 bg-slate-950/40 p-4">
                {output ? <MarkdownContent>{output}</MarkdownContent> : null}
                {loading ? (
                  <p className="mt-2 text-sm text-slate-500">
                    {!output ? "Running inference" : "Streaming"}
                    <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-teal-400 align-middle" />
                  </p>
                ) : null}
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
