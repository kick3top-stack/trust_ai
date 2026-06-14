# Threat Model

## Trust Boundaries

- **User** trusts cryptographic math, not operator claims
- **Operator** holds signing key and builds Merkle trees
- **Verifier** has receipt package + public key only

## STRIDE

| Category | Risk | MVP Mitigation |
|----------|------|----------------|
| Spoofing | Fake receipts | Ed25519 over Merkle root |
| Tampering | Alter receipt fields | Canonical hash check |
| Repudiation | Deny billing | Signed batch inclusion |
| Information disclosure | Prompt leakage | Hash-only storage |
| Denial of service | API flood | Rate limiting (planned) |
| Elevation | Key theft | File-mounted secrets |

## Out of Scope (MVP)

- Proof that inference actually ran
- External timestamp attestation
- Multi-party signing
