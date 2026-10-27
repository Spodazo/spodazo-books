---
name: finish-and-publish
description: Always complete the full job on main through production readiness, then ask the user to publish with pp. Use when finishing features, Railway deploys, or when the user says pp.
---

# Finish the job, then ask to publish

Do not leave work half-done. Railway (`https://books.spodazo.com`) deploys from `main` only. A commit that has not been pushed is not published.

## Before the first edit

Check out `main` and pull `origin/main`. Stay on `main`. Do not create a feature branch. A new chat cannot assume it is already on `main` — switch before editing.

## While working

1. Implement and test on `main`.
2. Commit locally on `main` when the change is complete. Do not push until the user says `pp`.
3. Finish everything the user needs in that local commit.
4. Then ask the user to publish. Their shortcut is `pp`. Do not assume they already said it.

## When the user says `pp`

Treat it as "please publish" — no extra confirmation:

1. Commit any remaining work on `main`.
2. `git push origin main`. No pull request. No merge step.
3. Confirm the Railway / GitHub deployment for that commit succeeded.
4. Reply with **live on Railway** and the commit short SHA.

Skip local browser verification unless they ask for it.

Never force-push `main`. Never update git config. Never skip hooks.

Do not stop at "it's committed locally." If they need it live, pushing `main` is the publish step.
