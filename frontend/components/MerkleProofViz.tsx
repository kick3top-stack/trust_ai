"use client";

interface ProofStep {
  hash: string;
  position: string;
}

export function MerkleProofViz({
  receiptHash,
  proof,
  merkleRoot,
  leafIndex,
}: {
  receiptHash: string;
  proof: ProofStep[];
  merkleRoot: string;
  leafIndex?: number;
}) {
  return (
    <div className="space-y-2 font-mono text-xs">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-teal-500/20 text-teal-400">
          ●
        </div>
        <div className="flex-1 rounded border border-teal-500/40 bg-teal-500/10 px-3 py-2">
          <span className="text-slate-500">Leaf </span>
          <span className="text-teal-300">{receiptHash.slice(0, 16)}...</span>
          {leafIndex !== undefined && (
            <span className="ml-2 text-slate-500">index {leafIndex}</span>
          )}
        </div>
      </div>

      {proof.map((step, i) => (
        <div key={i} className="flex items-center gap-3 pl-4">
          <div className="text-slate-600">↓ hash + sibling ({step.position})</div>
          <div className="flex-1 rounded border border-slate-700 bg-slate-900/50 px-3 py-1.5 text-slate-400">
            {step.hash.slice(0, 20)}...
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3 pt-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-violet-500/20 text-violet-400">
          ◆
        </div>
        <div className="flex-1 rounded border border-violet-500/40 bg-violet-500/10 px-3 py-2">
          <span className="text-slate-500">Merkle Root </span>
          <span className="text-violet-300">{merkleRoot.slice(0, 20)}...</span>
        </div>
      </div>
    </div>
  );
}
