---
name: finish-and-publish
description: Always complete the full job on main and push origin main in the same turn. A change is not done until that push. Use when finishing features, Railway deploys, or when the user says pp.
---

# Finish means push origin main

Do not leave work half-done. Railway (`https://books.spodazo.com`) deploys from `main` only. A change is not done until `git push origin main`. A commit that has not been pushed is not published.

## Before the first edit

Check out `main` and pull `origin/main`. Stay on `main`. Do not create a feature branch. A new chat cannot assume it is already on `main` — switch before editing.

## Finish in the same turn

1. Implement and test on `main`.
2. Commit on `main` when the change is complete.
3. `git push origin main` before you stop. No pull request. No merge step.
4. Confirm the Railway / GitHub deployment for that commit is pending or succeeded.
5. Reply with the commit short SHA and whether it is live on Railway yet.

Do not stop at "it's committed locally" and ask whether to publish.

## When the user says `pp`

Treat it as "please publish" if the push has not happened yet — no extra confirmation:

1. Commit any remaining work on `main`.
2. `git push origin main`. No pull request. No merge step.
3. Confirm the Railway / GitHub deployment for that commit succeeded.
4. Reply with **live on Railway** and the commit short SHA.

Skip local browser verification unless they ask for it.

Never force-push `main`. Never update git config. Never skip hooks.
