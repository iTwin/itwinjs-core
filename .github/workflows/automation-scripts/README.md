# Automation scripts

Scripts run by privileged release workflows (`finalize-release.yaml`,
`invalidate-open-prs.yaml`). These jobs load `IMJS_ADMIN_GH_TOKEN`, an admin PAT that can
push to protected branches and post status checks that gate merges. See the individual
script headers for what each does, and `rush-lockfile/README.md` for the pinned Rush
bootstrap dependency tree they install with `npm ci`.

## Emergency: rotating `IMJS_ADMIN_GH_TOKEN`

If the token is suspected compromised (leaked in logs, a workflow run was tampered with,
the `imodeljs-admin` account shows unexpected activity), rotate it immediately:

1. Revoke the current PAT: as `imodeljs-admin` (or an org admin acting on its behalf), go to
   GitHub Settings > Developer settings > Personal access tokens and delete/revoke the
   token in use. This invalidates it everywhere immediately, including any place it may
   have leaked to.
2. Audit recent activity: check `imodeljs-admin`'s recent pushes/API calls and the run logs
   of `finalize-release.yaml` / `invalidate-open-prs.yaml` for anything unexpected around
   the suspected compromise window.
3. Generate a replacement PAT for `imodeljs-admin` with the same scopes as before (repo
   push + status checks on `iTwin/itwinjs-core`; check the prior token's scopes if unsure
   before revoking it). Prefer the shortest expiration GitHub allows for this use case.
4. Update the `IMJS_ADMIN_GH_TOKEN` secret: repo Settings > Secrets and variables > Actions.
5. Re-run any release step that failed or was skipped because the token was revoked
   mid-rotation (see rollback below for `finalize-release.yaml` specifically).

## Rollback: a bad `finalize-release.yaml` push

`finalize-release.yaml` performs exactly one push, at the very end
(`git push --atomic origin <refs>`), after everything else has already been committed
locally. If that push lands bad changelog content on `master` or a `release/X.Y.x` branch:

1. Identify what was pushed: the workflow run log prints the exact refspecs pushed
   (`refs=...`), and the pushed commit's subject is `<version> Changelogs` (or, for a
   minor/major release, an additional `Update gather-docs.yaml's branch name...` commit).
2. Do not force-push over the branch. These are protected branches; prefer a revert.
   Open a PR that reverts the offending commit(s) with `git revert`, same as any other
   fix to a protected branch, and get it reviewed/merged normally.
3. If the push also included the `gather-docs.yaml`/`leftNav.md` commit (minor/major
   releases only), revert that commit too, or fix it forward in the same PR. Reverting it
   can be skipped if the docs repoint is actually correct and only the changelog merge was
   wrong.
4. Re-run `finalize-release.yaml` (`workflow_dispatch`) once the target branch is back in a
   good state, if changelogs still need to be re-merged.

For a run that fails _before_ the push step (e.g. the "Audit Rush lockfile" step, or
`update-changelogs.mjs` throwing), nothing has been pushed yet. Fix the underlying issue
(bump `rushVersion` and regenerate `rush-lockfile/package-lock.json` for an audit failure;
see that directory's README) and re-run the workflow.
