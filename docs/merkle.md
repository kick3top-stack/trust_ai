# Merkle Tree

## Construction

- **Leaf:** `receipt_hash` decoded to 32 bytes
- **Parent:** `SHA256(left_bytes || right_bytes)`
- **Odd leaves:** Last leaf duplicated (Bitcoin-style)

## Batching

Receipts accumulate in an open batch. When `TRUSTAI_BATCH_SIZE` is reached or `TRUSTAI_BATCH_SEAL_SECONDS` elapses, the batch is sealed:

1. Build Merkle tree from all receipt hashes
2. Sign root with Ed25519
3. Generate inclusion proof per receipt

## Proof Format

```json
{
  "version": "TRUSTAI_MERKLE_PROOF_V1",
  "receipt_hash": "...",
  "leaf_index": 0,
  "merkle_root": "...",
  "proof": [{"hash": "...", "position": "right"}],
  "tree_size": 4
}
```

## Verification

Walk from leaf to root applying sibling hashes per `position` (left/right).
