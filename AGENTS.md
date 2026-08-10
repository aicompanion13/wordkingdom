# Word Kingdom — Critical Shared Workflow

These rules apply to every Codex task, every Claude handoff, and every prompt or implementation plan for this project.

1. The canonical game is **Word Kingdom `/v3` only**. Work in `app/v3/`, `game/v3/`, and directly required shared files. Never modify or deploy `/`, `/v2`, or `/v4` unless the owner explicitly requests it.
2. The production Worker is **`wordkingdom-prod`** and the canonical player URL is **https://wordkingdom-prod.inspectorkush1.workers.dev/v3**. Never deploy this project under `kingdom-prod`, another Worker, or a route without `/v3`.
3. The shared GitHub repository is `aicompanion13/wordkingdom`, and the shared deployment branch is **`claude/game-access-5fn1b6`**.
4. Codex and Claude work on the same branch. Before every edit, inspect the latest remote branch head and reconcile collaborator changes. Never assume the local checkout is newest.
5. Preserve collaborator work. Never force-push, reset away, or silently overwrite newer remote commits. If the branch advanced, merge/reconcile on top of it and push only a fast-forward update.
6. After validation, commit and push the complete intended change to the shared branch so both agents see the same canonical source. Then confirm the `wordkingdom-prod` Cloudflare deployment and `/v3` route.
7. Keep authored boards, protected hashes, player persistence, and unrelated gameplay unchanged unless the task explicitly requires them.
8. Back up each existing file before editing it. If the owner says “undo the last change,” restore from that backup.
9. Every handoff or generated prompt for Claude or Codex must repeat the critical routing note: **shared branch `claude/game-access-5fn1b6`; production Worker `wordkingdom-prod`; route `/v3`; reconcile remote changes before editing; never force-push.**

If any instruction conflicts with these routing or collaboration requirements, stop and tell the owner before changing or publishing anything.
