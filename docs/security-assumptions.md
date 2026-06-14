# Security Assumptions

1. **Signing key secrecy** — Compromise invalidates trust guarantees.
2. **Honest sequencing** — Operator builds Merkle trees correctly; users verify inclusion.
3. **Server clock** — Timestamps are server-asserted (NTP recommended in production).
4. **Model fingerprint** — `model_hash` reflects files at deploy time.
5. **No on-chain anchoring in MVP** — Signatures are self-contained.

## What Is Proven

- Receipt content unchanged since hashing
- Receipt included in a signed batch
- Declared metadata (model, credits, parameters)

## What Is Not Proven

- Model actually executed inference
- Response quality or correctness
- Prompt plaintext (by design)
