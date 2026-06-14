"""Merkle proof generation and verification."""

from __future__ import annotations

from dataclasses import dataclass

from app.crypto.hashing import sha256_bytes
from app.merkle.tree import build_tree_levels, merkle_root


@dataclass(frozen=True)
class ProofStep:
    hash: str
    position: str  # "left" or "right"


@dataclass(frozen=True)
class MerkleProof:
    receipt_hash: str
    leaf_index: int
    merkle_root: str
    proof: list[ProofStep]
    tree_size: int

    def to_dict(self) -> dict:
        return {
            "version": "TRUSTAI_MERKLE_PROOF_V1",
            "receipt_hash": self.receipt_hash,
            "leaf_index": self.leaf_index,
            "merkle_root": self.merkle_root,
            "proof": [{"hash": s.hash, "position": s.position} for s in self.proof],
            "tree_size": self.tree_size,
        }


def generate_proof(leaves_hex: list[str], leaf_index: int) -> MerkleProof:
    leaves = [bytes.fromhex(h) for h in leaves_hex]
    levels = build_tree_levels(leaves)
    root = levels[-1][0]

    index = leaf_index
    proof_steps: list[ProofStep] = []

    for level_idx in range(len(levels) - 1):
        level = levels[level_idx]
        sibling_index = index - 1 if index % 2 == 1 else index + 1
        sibling = level[sibling_index]
        position = "left" if index % 2 == 1 else "right"
        proof_steps.append(ProofStep(hash=sibling.hex(), position=position))
        index //= 2

    return MerkleProof(
        receipt_hash=leaves_hex[leaf_index],
        leaf_index=leaf_index,
        merkle_root=root.hex(),
        proof=proof_steps,
        tree_size=len(leaves_hex),
    )


def verify_proof(leaf_hex: str, proof_steps: list[dict], expected_root_hex: str) -> bool:
    current = bytes.fromhex(leaf_hex)
    for step in proof_steps:
        sibling = bytes.fromhex(step["hash"])
        if step["position"] == "left":
            current = sha256_bytes(sibling + current)
        else:
            current = sha256_bytes(current + sibling)
    return current.hex() == expected_root_hex


def verify_proof_obj(proof: MerkleProof) -> bool:
    return verify_proof(
        proof.receipt_hash,
        [{"hash": s.hash, "position": s.position} for s in proof.proof],
        proof.merkle_root,
    )


def compute_root_from_leaves(leaves_hex: list[str]) -> str:
    leaves = [bytes.fromhex(h) for h in leaves_hex]
    return merkle_root(leaves).hex()
