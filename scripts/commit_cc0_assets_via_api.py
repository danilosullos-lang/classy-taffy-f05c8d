#!/usr/bin/env python3
"""Publish only staged, allow-listed CC0 assets through GitHub's Git Data API.

This avoids Git LFS checkout filters and never resets, force-pushes, or overwrites
unrelated game files. If main changed one of the same staged paths since the
workflow checkout, the publisher stops instead of replacing that change.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

API = "https://api.github.com"
API_VERSION = "2022-11-28"

class ApiError(RuntimeError):
    def __init__(self, status: int, body: str):
        super().__init__(f"GitHub API HTTP {status}: {body[:1200]}")
        self.status = status

def api(token: str, method: str, path: str, payload: dict | None = None) -> dict:
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(
        API + path,
        data=body,
        method=method,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": API_VERSION,
            "Content-Type": "application/json",
            "User-Agent": "Super-Hero-CC0-Asset-Publisher/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")
        raise ApiError(exc.code, detail) from exc

def git_bytes(*args: str) -> bytes:
    return subprocess.check_output(["git", *args])

def tree_map(token: str, repo: str, tree_sha: str) -> dict[str, str]:
    data = api(token, "GET", f"/repos/{repo}/git/trees/{tree_sha}?recursive=1")
    if data.get("truncated"):
        raise RuntimeError("GitHub tree response was truncated; refusing an incomplete path comparison.")
    return {entry["path"]: entry["sha"] for entry in data.get("tree", []) if entry.get("type") == "blob"}

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prefix", action="append", required=True,
                        help="Allowed exact file path or directory prefix ending in '/'. Repeat as needed.")
    parser.add_argument("--message", required=True)
    parser.add_argument("--branch", default="main")
    args = parser.parse_args()

    repo = os.environ.get("GITHUB_REPOSITORY", "")
    token = os.environ.get("GITHUB_TOKEN", "")
    base_sha = os.environ.get("GITHUB_SHA", "")
    if not repo or not token or not base_sha:
        raise RuntimeError("GITHUB_REPOSITORY, GITHUB_TOKEN and GITHUB_SHA are required.")

    staged = [p for p in git_bytes("diff", "--cached", "--name-only", "-z").decode("utf-8").split("\0") if p]
    if not staged:
        print("No staged CC0 asset changes; nothing to publish.")
        return 0
    deleted = [p for p in git_bytes("diff", "--cached", "--diff-filter=D", "--name-only", "-z").decode("utf-8").split("\0") if p]
    if deleted:
        raise RuntimeError(f"Refusing staged deletions: {deleted}")

    prefixes = args.prefix
    for path in staged:
        if path.startswith("/") or ".." in path.split("/") or not any(
            path.startswith(prefix) if prefix.endswith("/") else path == prefix
            for prefix in prefixes
        ):
            raise RuntimeError(f"Staged path is outside the explicit asset allowlist: {path}")

    print(f"Preparing {len(staged)} allow-listed staged file(s).")
    blobs = {}
    for path in staged:
        raw = git_bytes("show", f":{path}")
        if len(raw) > 90 * 1024 * 1024:
            raise RuntimeError(f"Refusing unexpectedly large staged asset: {path} ({len(raw)} bytes)")
        blob = api(token, "POST", f"/repos/{repo}/git/blobs", {
            "content": base64.b64encode(raw).decode("ascii"),
            "encoding": "base64",
        })
        blobs[path] = blob["sha"]
        print(f"Prepared {path} ({len(raw)} bytes).")

    base_commit = api(token, "GET", f"/repos/{repo}/git/commits/{base_sha}")
    base_tree_map = tree_map(token, repo, base_commit["tree"]["sha"])

    for attempt in range(1, 4):
        ref = api(token, "GET", f"/repos/{repo}/git/ref/heads/{args.branch}")
        current_head = ref["object"]["sha"]
        current_commit = api(token, "GET", f"/repos/{repo}/git/commits/{current_head}")
        current_tree_sha = current_commit["tree"]["sha"]
        current_tree_map = tree_map(token, repo, current_tree_sha)

        # Do not overwrite any same-path change made on main after this workflow checked out.
        for path, staged_sha in blobs.items():
            base_file_sha = base_tree_map.get(path)
            current_file_sha = current_tree_map.get(path)
            if current_file_sha != base_file_sha and current_file_sha != staged_sha:
                raise RuntimeError(
                    f"Conflict: {path} changed on main after workflow checkout; "
                    "no overwrite or force push was attempted."
                )

        entries = [
            {"path": path, "mode": "100644", "type": "blob", "sha": sha}
            for path, sha in sorted(blobs.items())
            if current_tree_map.get(path) != sha
        ]
        if not entries:
            print("The staged asset content is already present on main; no commit needed.")
            return 0

        tree = api(token, "POST", f"/repos/{repo}/git/trees", {
            "base_tree": current_tree_sha,
            "tree": entries,
        })
        if tree["sha"] == current_tree_sha:
            print("Git tree is unchanged; no commit needed.")
            return 0
        commit = api(token, "POST", f"/repos/{repo}/git/commits", {
            "message": args.message,
            "tree": tree["sha"],
            "parents": [current_head],
        })
        try:
            api(token, "PATCH", f"/repos/{repo}/git/refs/heads/{args.branch}", {
                "sha": commit["sha"],
                "force": False,
            })
            print(f"Published {len(entries)} asset/catalog path(s) in commit {commit['sha']}.")
            return 0
        except ApiError as exc:
            if exc.status not in (409, 422) or attempt == 3:
                raise
            print(f"main advanced during publish attempt {attempt}; retrying against the new head.")
            time.sleep(attempt * 2)

    raise RuntimeError("Could not publish staged assets after three safe fast-forward attempts.")

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
