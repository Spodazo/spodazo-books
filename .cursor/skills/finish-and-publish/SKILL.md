---
name: finish-and-publish
description: Always complete the full job through production readiness, then ask the user to publish with pp. Use when finishing features, PRs, Railway deploys, or when the user says pp.
---

# Finish the job, then ask to publish

Do not leave work half-done. Railway deploys from `main`. A feature branch or open PR is not published.

## While working

1. Implement, test, commit, and push as you go.
2. Open or update the pull request.
3. Finish everything the user needs: code, tests, and a PR that can merge to `main`.
4. Then ask the user to publish. Their shortcut is `pp`. Do not assume they already said it.

## When the user says `pp`

Treat it as "please publish" — no extra confirmation:

1. Commit any remaining work.
2. Push the branch.
3. Merge the PR into `main` so Railway deploys.
4. Confirm `main` has the commits.

Skip local browser verification unless they ask for it.

Do not stop at "it's on a branch." If they need it live, merging to `main` is part of publish.
