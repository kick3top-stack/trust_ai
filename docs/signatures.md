# Signatures

## Algorithm

Ed25519 (RFC 8032) via the `cryptography` library.

## Signed Message

Raw 32-byte Merkle root (binary), not the hex string.

## Key Management

- Generate: `python scripts/generate_signing_key.py --output secrets/signing_key.pem`
- Public key: `GET /api/v1/admin/public-key`
- Rotation: New `signing_key_id`; old batches remain verifiable with historical public keys

## root_signature.json

Contains `merkle_root`, `signature` (base64), `public_key` (base64), `signing_key_id`, `batch_number`, `receipt_count`, `signed_at`.
