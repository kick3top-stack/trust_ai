export interface VerifyPackage {
  receipt: Record<string, unknown>;
  merkle_proof: Record<string, unknown>;
  root_signature: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickPackage(obj: Record<string, unknown>): VerifyPackage | null {
  const receipt = obj.receipt;
  const merkle_proof = obj.merkle_proof;
  const root_signature = obj.root_signature;
  if (isRecord(receipt) && isRecord(merkle_proof) && isRecord(root_signature)) {
    return { receipt, merkle_proof, root_signature };
  }
  return null;
}

export function parseJsonPackage(text: string): VerifyPackage {
  const parsed = JSON.parse(text) as unknown;
  if (!isRecord(parsed)) throw new Error("JSON must be an object");

  const direct = pickPackage(parsed);
  if (direct) return direct;

  if (isRecord(parsed.receipt)) {
    throw new Error("Package must include merkle_proof and root_signature");
  }

  if (parsed.request_id && parsed.receipt_hash) {
    return { receipt: parsed, merkle_proof: {}, root_signature: {} };
  }

  throw new Error("Unrecognized JSON format");
}

export async function parseVerifyFiles(files: FileList | File[]): Promise<VerifyPackage> {
  const list = Array.from(files);
  if (list.length === 0) throw new Error("No files selected");

  let receipt: Record<string, unknown> | null = null;
  let merkleProof: Record<string, unknown> | null = null;
  let rootSignature: Record<string, unknown> | null = null;

  for (const file of list) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".zip")) {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      for (const name of Object.keys(zip.files)) {
        const entry = zip.files[name];
        if (entry.dir) continue;
        const base = name.split("/").pop()?.toLowerCase() || "";
        const text = await entry.async("text");
        const data = JSON.parse(text) as unknown;
        if (!isRecord(data)) continue;
        if (base.includes("receipt")) receipt = data;
        else if (base.includes("merkle") || base.includes("proof")) merkleProof = data;
        else if (base.includes("signature")) rootSignature = data;
      }
      continue;
    }

    const text = await file.text();
    if (lower.endsWith(".json")) {
      try {
        const pkg = parseJsonPackage(text);
        if (pkg.merkle_proof && Object.keys(pkg.merkle_proof).length) {
          return pkg;
        }
        receipt = pkg.receipt;
        if (pkg.merkle_proof && Object.keys(pkg.merkle_proof).length) merkleProof = pkg.merkle_proof;
        if (pkg.root_signature && Object.keys(pkg.root_signature).length) rootSignature = pkg.root_signature;
      } catch {
        const data = JSON.parse(text) as unknown;
        if (!isRecord(data)) continue;
        if (lower.includes("receipt")) receipt = data;
        else if (lower.includes("merkle") || lower.includes("proof")) merkleProof = data;
        else if (lower.includes("signature")) rootSignature = data;
        else if (data.receipt_hash) receipt = data;
      }
    }
  }

  if (receipt && merkleProof && rootSignature) {
    return { receipt, merkle_proof: merkleProof, root_signature: rootSignature };
  }

  throw new Error("Provide receipt.json, merkle_proof.json, and root_signature.json (or a .zip package)");
}
