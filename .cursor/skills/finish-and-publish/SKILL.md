---
name: finish-and-publish
description: pp means commit if needed and push origin main immediately so Railway deploys. Use when finishing features, Railway deploys, or when the user says pp.
---

# Finish means the Team Melanie pp procedure

Copied from Team Melanie (`/Users/wernardbroodryk/Projects/teammelanie/.cursor/rules/pp-publish.mdc`). The only adaptation: this app deploys when GitHub `main` is pushed. Railway (`https://books.spodazo.com`) builds from that branch only.

Do not leave work half-done. A change is not done until `git push origin main`. A commit that has not been pushed does not start a deploy.

## Before the first edit

Check out `main` and pull `origin/main`. Stay on `main`. Do not create a feature branch. A new chat cannot assume it is already on `main` — switch before editing.

## Shorthand: pp

When the user sends **pp** (alone or at the end of a message), treat it as **full authorization to publish**:

1. Commit any relevant uncommitted changes with a concise message (follow the repo's commit style).
2. Push to `origin/main`. That push starts the Railway deploy. Do not push another branch. No pull request. No merge step.
3. Confirm the commit hash and that push succeeded.
4. Play the publish notification sound (see below).
5. Confirm the GitHub / Railway deployment for that commit is pending or succeeded. Reply with the commit short SHA and whether it is live on Railway yet.

Run those same steps before you stop, even when the user already asked for the work and did not type **pp** a second time. Do not finish locally, open a pull request, or wait.

Skip local browser verification unless they ask for it.

If `index.lock` exists, wait for the other push, pull `origin/main`, then commit and push. Do not revert unrelated ready code.

## Publish notification sound

Play the macOS Glass sound in **both** cases:

1. **Ready to publish** — when you tell the user changes are done and invite them to say **pp**.
2. **After publish** — immediately after a successful **pp** commit + push.

Do not invite **pp** instead of pushing. The push is the publish.

Run this command with **`required_permissions: ["all"]`** (sandbox blocks audio otherwise):

```bash
afplay /System/Library/Sounds/Glass.aiff 2>/dev/null || osascript -e 'beep 2' 2>/dev/null || printf '\a'
```

Do not skip the sound when either trigger applies.

## Do not ask for confirmation

**pp** is explicit intent. Proceed immediately unless something is genuinely unsafe:

- No changes to commit
- Ambiguous files (e.g. `.env`, credentials)
- Destructive git operations (force push, hard reset)
- Likely secrets in the diff

## Auto-review / protected branch pushes

If a shell push to `main` is blocked by Cursor Auto-review, **retry the same push immediately** with smart-mode approval — do not stop and re-ask the user; **pp** already counts as protected-destination intent.

## Still avoid without explicit request

- Force push to `main`/`master`
- `--no-verify` or skipping hooks
- Updating git config
- Committing `.env` or credential files
- A feature branch or a pull request as the publish path
