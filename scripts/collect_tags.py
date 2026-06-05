#!/usr/bin/env python3
"""Collect tagged Moltbook.com posts and update incoming.json.

Runs once a day. Searches Moltbook.com API for posts containing
[MOLTBOOK_PODCAST_SUBMIT] and publishes verified candidates to
assets/community/incoming.json.

Configuration via environment variables (or .env in the site root):
    MOLTBOOK_API_BASE_URL  — default: https://www.moltbook.com/api
    MOLTBOOK_API_TOKEN     — optional bearer token
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SITE_ROOT = Path(__file__).resolve().parent.parent
INCOMING_PATH = SITE_ROOT / "assets" / "community" / "incoming.json"
TAG = "[MOLTBOOK_PODCAST_SUBMIT]"
SCHEMA_VERSION = "moltbook.agent_community.incoming.v1"

API_BASE = os.getenv("MOLTBOOK_API_BASE_URL", "https://www.moltbook.com/api").rstrip("/")
API_TOKEN = os.getenv("MOLTBOOK_API_TOKEN") or None


def _headers() -> dict[str, str]:
    headers = {
        "Accept": "application/json",
        "User-Agent": "moltbook-collector/0.1 (agent-tag-collector)",
    }
    if API_TOKEN:
        headers["Authorization"] = f"Bearer {API_TOKEN}"
    return headers


def _extract_items(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ("items", "posts", "data", "results"):
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
        if isinstance(value, dict):
            nested = _extract_items(value)
            if nested:
                return nested
    return []


def _parse_post(item: dict[str, Any]) -> dict[str, Any] | None:
    post_id = item.get("id") or item.get("uuid") or item.get("_id") or item.get("slug")
    if not post_id:
        return None

    text = item.get("text") or item.get("body") or item.get("description") or ""
    if isinstance(item.get("content"), str):
        text = item["content"]
    elif isinstance(item.get("content"), dict):
        text = item["content"].get("text") or item["content"].get("body") or text

    author_raw = item.get("author") or item.get("user") or {}
    if isinstance(author_raw, dict):
        author_name = author_raw.get("name") or author_raw.get("username") or author_raw.get("handle") or ""
        author_id = author_raw.get("handle") or author_raw.get("username") or author_raw.get("name") or ""
    else:
        author_name = str(author_raw) if author_raw else ""
        author_id = author_name

    tags = item.get("tags") or item.get("hashtags") or item.get("topics") or []
    if isinstance(tags, str):
        tags = [t.strip().lstrip("#") for t in tags.split(",") if t.strip()]
    elif isinstance(tags, list):
        tags = [str(t).strip().lstrip("#") for t in tags if str(t).strip()]
    else:
        tags = []

    created_at = item.get("created_at") or item.get("createdAt") or item.get("published_at") or item.get("date")

    profile_url = ""
    if author_id:
        profile_url = f"https://www.moltbook.com/u/{author_id}"

    post_url = item.get("url") or item.get("permalink") or item.get("link") or profile_url

    return {
        "post_id": str(post_id),
        "author_id": str(author_id),
        "author_name": str(author_name) or str(author_id),
        "author_profile_url": profile_url,
        "source_post_url": post_url,
        "text": str(text),
        "tags": [str(t) for t in tags],
        "created_at": str(created_at) if created_at else None,
    }


def _has_tag(post: dict[str, Any], tag: str) -> bool:
    raw_tags = post.get("tags") or []
    full_text = f"{post.get('text', '')} {post.get('author_name', '')} {post.get('author_id', '')}".lower()
    tag_lower = tag.lower()

    for t in raw_tags:
        if tag_lower in str(t).lower():
            return True

    if tag_lower in full_text:
        return True

    return False


def fetch_tagged_posts(tag: str = TAG) -> list[dict[str, Any]]:
    try:
        import httpx
    except ImportError as exc:
        print(f"[collect_tags] httpx not available: {exc}", file=sys.stderr)
        print("[collect_tags] Install with: pip install httpx", file=sys.stderr)
        return []

    results: list[dict[str, Any]] = []

    endpoints = [f"{API_BASE}/posts", f"{API_BASE}/feed"]
    for endpoint in endpoints:
        try:
            with httpx.Client(timeout=60.0, follow_redirects=True) as client:
                response = client.get(
                    endpoint,
                    headers=_headers(),
                    params={"limit": "50", "sort": "new"},
                )
                response.raise_for_status()
                payload = response.json()
        except Exception as exc:
            print(f"[collect_tags] Warning: {endpoint} failed: {exc}", file=sys.stderr)
            continue

        candidates = _extract_items(payload)
        print(f"[collect_tags] {endpoint}: {len(candidates)} raw items fetched")

        for item in candidates:
            post = _parse_post(item)
            if not post or not post.get("text"):
                continue
            if _has_tag(post, tag):
                results.append(post)

        if results:
            break

    return results


def load_existing_incoming() -> dict[str, Any]:
    if INCOMING_PATH.exists():
        try:
            return json.loads(INCOMING_PATH.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            print(f"[collect_tags] Could not read existing incoming.json: {exc}", file=sys.stderr)
    return {
        "schema": SCHEMA_VERSION,
        "status": "Experimental",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "stats": {"candidates": 0, "verified": 0, "quarantined": 0},
        "items": [],
    }


def post_to_community_item(post: dict[str, Any]) -> dict[str, Any]:
    text = post.get("text", "")
    if len(text) > 500:
        text = text[:497] + "..."

    target = _infer_target_round(post)

    return {
        "type": "candidate",
        "status": "observed",
        "verification_method": "tagged_api_collector",
        "author_id": post.get("author_id", ""),
        "author_name": post.get("author_name", ""),
        "author_profile_url": post.get("author_profile_url", ""),
        "source_post_url": post.get("source_post_url", ""),
        "target_episode_id": target,
        "text": text,
        "collected_at": datetime.now(timezone.utc).isoformat(),
    }


def _infer_target_round(post: dict[str, Any]) -> str:
    text = (post.get("text", "") or "").lower()
    tags = [str(t).lower() for t in post.get("tags", [])]

    for tag in tags:
        if "round-" in tag:
            parts = tag.split("round-")
            if len(parts) > 1:
                number = parts[1].split()[0].strip()
                return f"round-{number}"

    for keyword in ("round 002", "round-002", "round 2"):
        if keyword in text:
            return "round-002"

    return "open path"


def merge_candidates(existing: dict[str, Any], new_items: list[dict[str, Any]]) -> dict[str, Any]:
    old_items = existing.get("items") or []
    old_keys = {
        f"{item.get('author_id', '')}:{item.get('source_post_url', '')}:{item.get('text', '')[:80]}"
        for item in old_items
    }

    merged = list(old_items)
    for item in new_items:
        key = f"{item.get('author_id', '')}:{item.get('source_post_url', '')}:{item.get('text', '')[:80]}"
        if key not in old_keys:
            merged.append(item)
            old_keys.add(key)

    existing["items"] = merged
    existing["generated_at"] = datetime.now(timezone.utc).isoformat()
    existing["stats"] = {
        "candidates": len(merged),
        "verified": sum(1 for item in merged if item.get("status") == "verified"),
        "quarantined": sum(1 for item in merged if item.get("status") == "quarantined"),
    }
    return existing


def write_incoming(data: dict[str, Any]) -> None:
    INCOMING_PATH.parent.mkdir(parents=True, exist_ok=True)
    INCOMING_PATH.write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"[collect_tags] Written {len(data.get('items', []))} items to {INCOMING_PATH}")


def main() -> None:
    print(f"[collect_tags] Starting collection at {datetime.now(timezone.utc).isoformat()}")
    print(f"[collect_tags] API: {API_BASE}  Tag: {TAG}")

    existing = load_existing_incoming()

    print("[collect_tags] Fetching tagged posts from Moltbook.com API...")
    tagged = fetch_tagged_posts(TAG)

    if not tagged:
        print("[collect_tags] No new tagged posts found. Incoming manifest unchanged.")
        write_incoming(existing)
        return

    print(f"[collect_tags] Found {len(tagged)} tagged posts")
    new_items = [post_to_community_item(post) for post in tagged]
    merged = merge_candidates(existing, new_items)
    write_incoming(merged)


if __name__ == "__main__":
    main()
