"""Phase 0 acceptance gate (PLAN.md §9): projected cost per session must land
under $1-2 with the planned model mix. Run before building further; exits 1 if over.

Usage: python scripts/cost_check.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.llm import MODEL_DEFAULT, MODEL_HEAVY, MODEL_LIGHT, PRICING

GATE_USD = 2.00
ROUNDS = 7  # Problem..Decision; +1 possible Editor loop-back covered by margin

# (model, calls_per_round, input_tokens, output_tokens) — inputs sized from the
# actual prompt builders: persona (~250) + concept (~150) + whiteboard (~400)
# + 8 recent messages (~800) ≈ 1,600 input tokens per debate turn.
PER_ROUND = [
    ("moderator open", MODEL_DEFAULT, 1, 1_000, 120),
    ("agent debate turns", MODEL_DEFAULT, 4, 1_600, 300),
    ("consensus probes", MODEL_LIGHT, 2, 1_200, 30),
    ("round summary (Opus)", MODEL_HEAVY, 1, 2_200, 300),
    ("scribe whiteboard", MODEL_LIGHT, 1, 1_000, 400),
    ("editor gap check", MODEL_LIGHT, 1, 1_200, 80),
]
FINAL = [
    ("final compile (Opus)", MODEL_HEAVY, 1, 3_500, 1_800),
]
# Server-side web search: ~$10 per 1,000 searches; assume ~6 searches/session.
WEB_SEARCH_USD = 6 * 0.01


def cost(model: str, n: int, inp: int, out: int) -> float:
    pi, po = PRICING[model]
    return n * (inp * pi + out * po) / 1_000_000


def main() -> int:
    total = WEB_SEARCH_USD
    print(f"{'call':<28}{'model':<22}{'per session':>12}")
    print("-" * 62)
    for label, model, n, inp, out in PER_ROUND:
        c = cost(model, n, inp, out) * ROUNDS
        total += c
        print(f"{label:<28}{model:<22}${c:>10.4f}")
    for label, model, n, inp, out in FINAL:
        c = cost(model, n, inp, out)
        total += c
        print(f"{label:<28}{model:<22}${c:>10.4f}")
    print(f"{'web search (~6 calls)':<28}{'server tool':<22}${WEB_SEARCH_USD:>10.4f}")
    print("-" * 62)
    print(f"{'PROJECTED TOTAL':<50}${total:>10.4f}")
    print(f"{'gate':<50}${GATE_USD:>10.2f}")

    if total > GATE_USD:
        print("\n❌ FAIL — over the Phase 0 gate. Fix model routing/turn caps first.")
        return 1
    print(f"\n✅ PASS — {total / GATE_USD:.0%} of the ${GATE_USD:.2f} gate. "
          "Runtime CostMeter enforces the ceiling on real usage regardless.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
