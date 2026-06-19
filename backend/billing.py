"""Per-user auth + lifetime spend guardrails, backed by Supabase.

Every session must present a Supabase access token. We verify it server-side,
then enforce a *lifetime* USD budget per user (default $2). The owner email is
exempt. Spend is tracked in a Supabase table so the cap survives restarts and
redeploys (Railway's filesystem is ephemeral, so a local file would reset).

Required backend env:
    SUPABASE_URL                 e.g. https://xxxx.supabase.co
    SUPABASE_SERVICE_ROLE_KEY    server-only secret (bypasses RLS for writes)
Optional:
    OWNER_EMAIL                  default sauhamv28@gmail.com (unlimited)
    FREE_USER_BUDGET_USD         default 2.00 (lifetime cap for everyone else)
    REQUIRE_AUTH                 default "1"; set "0" for local/mock dev only
"""
from __future__ import annotations

import logging
import os

import httpx

log = logging.getLogger("founders-room.billing")

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
OWNER_EMAIL = os.getenv("OWNER_EMAIL", "sauhamv28@gmail.com").strip().lower()
FREE_BUDGET_USD = float(os.getenv("FREE_USER_BUDGET_USD", "2.00"))
REQUIRE_AUTH = os.getenv("REQUIRE_AUTH", "1") == "1"

_TIMEOUT = httpx.Timeout(10.0)


class AuthError(Exception):
    """Token missing/invalid, or the server isn't configured for auth."""


class BudgetReached(Exception):
    """User has already spent their lifetime budget."""


def configured() -> bool:
    return bool(SUPABASE_URL and SERVICE_KEY)


def is_owner(email: str) -> bool:
    return bool(email) and email.strip().lower() == OWNER_EMAIL


async def verify_user(token: str | None) -> dict:
    """Validate a Supabase access token. Returns {'id', 'email'} or raises AuthError."""
    if not REQUIRE_AUTH:
        return {"id": "local-dev", "email": OWNER_EMAIL}
    if not token:
        raise AuthError("Sign in to start a session.")
    if not configured():
        raise AuthError("Auth is not configured on the server.")
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {token}"},
            )
    except httpx.HTTPError as e:
        log.warning("verify_user transport error: %s", e)
        raise AuthError("Could not reach the auth service. Try again.") from e
    if resp.status_code != 200:
        raise AuthError("Your session has expired. Please sign in again.")
    user = resp.json()
    return {"id": user.get("id", ""), "email": (user.get("email") or "").lower()}


async def get_usage(user_id: str) -> tuple[float, float]:
    """Return (spent_usd, budget_usd) for a user, defaulting to (0, FREE_BUDGET)."""
    if not REQUIRE_AUTH or not configured():
        return 0.0, FREE_BUDGET_USD
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                f"{SUPABASE_URL}/rest/v1/user_usage",
                params={"user_id": f"eq.{user_id}", "select": "spent_usd,budget_usd"},
                headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"},
            )
        if resp.status_code == 200 and resp.json():
            row = resp.json()[0]
            return float(row["spent_usd"]), float(row["budget_usd"])
    except (httpx.HTTPError, KeyError, ValueError) as e:
        log.warning("get_usage error for %s: %s", user_id, e)
    return 0.0, FREE_BUDGET_USD


async def add_usage(user_id: str, email: str, amount: float) -> None:
    """Atomically add `amount` USD to a user's lifetime spend (upsert via RPC)."""
    if amount <= 0 or not REQUIRE_AUTH or not configured() or not user_id:
        return
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            await client.post(
                f"{SUPABASE_URL}/rest/v1/rpc/add_usage",
                headers={
                    "apikey": SERVICE_KEY,
                    "Authorization": f"Bearer {SERVICE_KEY}",
                    "Content-Type": "application/json",
                },
                json={"p_user": user_id, "p_email": email, "p_amount": amount},
            )
    except httpx.HTTPError as e:
        log.warning("add_usage failed for %s ($%.4f): %s", user_id, amount, e)


async def authorize_session(token: str | None) -> tuple[dict, float]:
    """Verify the user and return (user, remaining_budget_usd).

    Raises AuthError if the token is bad, BudgetReached if the lifetime cap is hit.
    The owner gets an unbounded budget (inf).
    """
    user = await verify_user(token)
    if is_owner(user["email"]):
        return user, float("inf")
    spent, budget = await get_usage(user["id"])
    remaining = budget - spent
    if remaining <= 0:
        raise BudgetReached(
            f"You've reached your ${budget:.2f} usage limit. "
            f"Email {OWNER_EMAIL} to have it raised."
        )
    return user, remaining
