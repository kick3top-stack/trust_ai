# ZK Roadmap

## V1 (MVP)

Hash + Merkle + Ed25519 execution receipts.

## V2

Optional encrypted `execution_witness` blob held by client.

## V3

zkSNARK proves inference correctness without revealing prompt (per model family circuit).

## V4

Recursive proofs compressing multiple receipts into single proof.

## Integration Points

- `ZKProver` interface in `backend/app/domain/interfaces/`
- `receipt_version` field for verifier branching
- Post-sign hook in `BatchService`
