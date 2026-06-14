#!/usr/bin/env python3
"""Generate Ed25519 signing key for TrustAI."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.crypto.ed25519 import generate_keypair, public_key_to_base64, save_private_key_pem


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate TrustAI Ed25519 signing key")
    parser.add_argument(
        "--output",
        default="secrets/signing_key.pem",
        help="Output path for private key PEM",
    )
    parser.add_argument("--key-id", default="trustai-signing-v1")
    args = parser.parse_args()

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    if output.exists():
        print(f"Key already exists at {output}")
        return

    keypair = generate_keypair(args.key_id)
    save_private_key_pem(keypair.private_key, str(output))
    print(f"Private key written to {output}")
    print(f"Key ID: {args.key_id}")
    print(f"Public key (base64): {public_key_to_base64(keypair.public_key)}")


if __name__ == "__main__":
    main()
