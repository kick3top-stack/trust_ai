"""Unit tests for Merkle tree."""

from app.crypto.hashing import sha256_hex
from app.merkle.proof import compute_root_from_leaves, generate_proof, verify_proof
from app.merkle.tree import merkle_root


def _leaf(text: str) -> str:
    return sha256_hex(text)


def test_merkle_root_two_leaves():
    leaves = [_leaf("a"), _leaf("b")]
    root = compute_root_from_leaves(leaves)
    assert len(root) == 64


def test_merkle_proof_verify():
    leaves = [_leaf("r1"), _leaf("r2"), _leaf("r3"), _leaf("r4")]
    proof = generate_proof(leaves, 2)
    assert verify_proof(proof.receipt_hash, [{"hash": s.hash, "position": s.position} for s in proof.proof], proof.merkle_root)
    assert proof.merkle_root == merkle_root([bytes.fromhex(h) for h in leaves]).hex()


def test_odd_leaf_duplication():
    leaves = [_leaf("only")]
    root1 = merkle_root([bytes.fromhex(leaves[0])])
    proof = generate_proof(leaves, 0)
    assert verify_proof(proof.receipt_hash, [{"hash": s.hash, "position": s.position} for s in proof.proof], proof.merkle_root)
