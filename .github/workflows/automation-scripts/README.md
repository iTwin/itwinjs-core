# Automation scripts

Scripts run by privileged release workflows (`finalize-release.yaml`,
`invalidate-open-prs.yaml`). These jobs load `IMJS_ADMIN_GH_TOKEN`, an admin PAT that can
push to protected branches and post status checks that gate merges. See the individual
script headers for what each does, and `rush-lockfile/README.md` for the pinned Rush
bootstrap dependency tree they install with `npm ci`.

## Emergency: rotating `IMJS_ADMIN_GH_TOKEN`

If the token is suspected compromised (leaked in logs, a workflow run was tampered with,
the `imodeljs-admin` account shows unexpected activity), rotate it immediately. The
replacement PAT must be issued to `imodeljs-admin` with:

- Fine-grained PAT, scoped to `iTwin/itwinjs-core`, with **Contents: Read and write**
  (pushes in `finalize-release.yaml`), **Commit statuses: Read and write**, and
  **Pull requests: Read-only** (both used by `invalidate-open-prs.yaml`). A classic PAT
  with the `repo` scope also works.
- The shortest expiration GitHub allows for this use case.

Steps (permissions above don't require inspecting the old token, so revoke first):

1. Revoke the current PAT: as `imodeljs-admin` (or an org admin acting on its behalf), go to
   GitHub Settings > Developer settings > Personal access tokens and delete/revoke the
   token in use. This invalidates it everywhere immediately, including any place it may
   have leaked to.
2. Audit recent activity: check `imodeljs-admin`'s recent pushes/API calls and the run logs
   of `finalize-release.yaml` / `invalidate-open-prs.yaml` for anything unexpected around
   the suspected compromise window.
3. Generate a replacement PAT for `imodeljs-admin` with the permissions listed above.
4. Update the `IMJS_ADMIN_GH_TOKEN` secret: repo Settings > Secrets and variables > Actions.
5. Re-run any release step that failed or was skipped because the token was revoked
   mid-rotation (see rollback below for `finalize-release.yaml` specifically).

## Rollback: a bad `finalize-release.yaml` push

`finalize-release.yaml` performs exactly one push, at the very end
(`git push --atomic origin <refs>`), after everything else has already been committed
locally. If that push lands bad changelog content on `master` or a `release/X.Y.x` branch:

1. Identify what was pushed: the workflow run log prints the exact refspecs pushed
   (`refs=...`). For a `.0` (minor/major) release these are two separate commits on two
   separate branches, pushed in this order:
   - `Update gather-docs.yaml's branch name to the release branch`, pushed straight to the
     `release/X.Y.x` branch being released.
   - `<version> Changelogs` (which also carries the `leftNav.md` update linking the new
     changehistory doc), pushed to the target branch (`master`, or the next-oldest
     `release/X.Y.x` branch).
   For a patch release, only the `<version> Changelogs` commit exists, on the target
   branch.
2. Do not force-push over either branch. These are protected branches; prefer a revert.
   Because the two commits above land on different branches, open one revert PR per
   affected branch (`git revert`, same as any other fix to a protected branch), and get
   each reviewed/merged normally.
   - Reverting the `gather-docs.yaml` commit on the release branch can be skipped if that
     repoint is actually correct and only the changelog merge on the target branch was
     wrong.
3. Re-run `finalize-release.yaml` (`workflow_dispatch`) once the target branch(es) are back
   in a good state, if changelogs still need to be re-merged.

For a run that fails _before_ the push step (e.g. the "Audit Rush lockfile" step, or
`update-changelogs.mjs` throwing), nothing has been pushed yet. Fix the underlying issue
(bump `rushVersion` and regenerate `rush-lockfile/package-lock.json` for an audit failure;
see that directory's README) and re-run the workflow.
