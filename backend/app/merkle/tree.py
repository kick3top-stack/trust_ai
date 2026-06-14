"""Merkle tree construction."""

from __future__ import annotations

from app.crypto.hashing import sha256_bytes


def _normalize_leaves(leaves: list[bytes]) -> list[bytes]:
    if not leaves:
        return []
    if len(leaves) == 1:
        return [leaves[0], leaves[0]]
    if len(leaves) % 2 == 1:
        return leaves + [leaves[-1]]
    return leaves


def merkle_root(leaves: list[bytes]) -> bytes:
    if not leaves:
        raise ValueError("Cannot compute Merkle root of empty tree")
    level = _normalize_leaves(leaves)
    while len(level) > 1:
        next_level: list[bytes] = []
        for i in range(0, len(level), 2):
            combined = level[i] + level[i + 1]
            next_level.append(sha256_bytes(combined))
        level = next_level
    return level[0]


def build_tree_levels(leaves: list[bytes]) -> list[list[bytes]]:
    """Return all tree levels bottom-up for proof generation."""
    if not leaves:
        raise ValueError("Cannot build tree from empty leaves")
    levels: list[list[bytes]] = [_normalize_leaves(leaves)]
    while len(levels[-1]) > 1:
        current = levels[-1]
        next_level: list[bytes] = []
        for i in range(0, len(current), 2):
            combined = current[i] + current[i + 1]
            next_level.append(sha256_bytes(combined))
        levels.append(next_level)
    return levels
