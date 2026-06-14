#!/usr/bin/env python3
"""Offline receipt verification CLI."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.verifier.pipeline import verify_package


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify TrustAI receipt package offline")
    parser.add_argument("--receipt", required=True, help="Path to receipt.json")
    parser.add_argument("--proof", required=True, help="Path to merkle_proof.json")
    parser.add_argument("--signature", required=True, help="Path to root_signature.json")
    args = parser.parse_args()

    receipt = json.loads(Path(args.receipt).read_text(encoding="utf-8"))
    proof = json.loads(Path(args.proof).read_text(encoding="utf-8"))
    signature = json.loads(Path(args.signature).read_text(encoding="utf-8"))

    result = verify_package(receipt, proof, signature)
    print(json.dumps({
        "valid": result.valid,
        "checks": result.checks.to_dict(),
        "reason": result.reason,
        "receipt_hash": result.receipt_hash,
        "merkle_root": result.merkle_root,
    }, indent=2))

    sys.exit(0 if result.valid else 1)


if __name__ == "__main__":
    main()
