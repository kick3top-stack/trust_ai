# TrustAI Documentation

## Architecture

TrustAI separates AI inference from cryptographic receipt infrastructure:

- **API layer** (`backend/app/api/`) — HTTP adapters only
- **Service layer** (`backend/app/services/`) — use-case orchestration
- **Crypto layer** (`backend/app/crypto/`, `backend/app/merkle/`) — pure functions
- **Verifier** (`backend/app/verifier/`) — offline-capable verification pipeline

## Receipt Format

Each receipt contains hashed prompts/responses (never plaintext), model metadata, parameters, credit cost, and timestamp. Canonical serialization uses `RECEIPT_V1` line format with lexicographically sorted fields.

## Merkle Tree

Receipt hashes are leaves. Parent nodes are `SHA256(left || right)`. Odd leaf counts duplicate the last leaf. Batches seal at `TRUSTAI_BATCH_SIZE` receipts or `TRUSTAI_BATCH_SEAL_SECONDS`.

## Signatures

Ed25519 signs the raw 32-byte Merkle root. Public key is distributed via `/admin/public-key` and embedded in `root_signature.json`.

## Threat Model

| Threat | Mitigation |
|--------|------------|
| Receipt tampering | Canonical hash verification |
| Batch exclusion | Merkle inclusion proof |
| Forged batches | Ed25519 signature |
| Prompt leakage | Hash-only storage |

**Not proven in MVP:** model actually ran inference (vs fabricated response).

## Security Assumptions

- Signing key secrecy
- Honest Merkle tree construction
- Server-asserted timestamps

## ZK Roadmap

1. V1: Hash + Merkle + Ed25519 (current)
2. V2: Encrypted execution witness
3. V3: zkSNARK per model family
4. V4: Recursive batch proofs

## Deployment

See [README.md](../README.md) for Docker Compose instructions.
