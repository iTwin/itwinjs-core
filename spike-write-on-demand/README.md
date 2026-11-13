# Write-on-demand spike: how to run

Two Studio instances, Curtis as the startup app, Spatial Editor as a plugin, one QA iModel.

## What is built

- iTwin.js 5.15.0 + spike: this branch, `spike/write-on-demand` in iTwin/itwinjs-core.
- Studio + spike: branch `spike/write-on-demand` in iTwin/studio. The patched iTwin.js is linked with packlink. Do not commit `package.json`, `pnpm-lock.yaml`, or `pnpm-workspace.yaml` there. Undo with `packlink unlink --all`.
- Curtis: built in `~/source/studio-apps/packages/apps/itwin-studio-app` (`pnpm build-dev`).
- Spatial Editor: existing build in `~/source/spatial-editor-studio/packages/spatial-editor-studio` (Oct 13).

## Link this iTwin.js into Studio

Packlink: https://github.com/iTwin/studio-dev-tools/tree/main/packages/packlink

```sh
# in this repository
rush install
rush build -t @itwin/core-backend -t @itwin/core-frontend -t @itwin/editor-frontend
for p in core/common core/backend core/frontend editor/frontend; do (cd $p && packlink push --no-deps --no-build); done

# in the Studio checkout (spike/write-on-demand)
pnpm install
packlink link @itwin/core-common @itwin/core-backend @itwin/core-frontend @itwin/editor-frontend
pnpm build
```

If ports 3000 or 3010 are in use, set `STUDIO_FRONTEND_PORT`, `STUDIO_PROMPT_PAGE_PORT` and `STUDIO_MCP_PORT` (each instance needs its own MCP and prompt-page port). Start the dev server with `vite --force` after each relink.

## Start

Terminal 1 (frontend dev server):

```sh
cd <studio checkout on spike/write-on-demand>/packages/framework
pnpm start-frontend
```

Terminal 2 (instance A):

```sh
cd <studio checkout on spike/write-on-demand>/packages/framework
CURTIS=~/source/studio-apps/packages/apps/itwin-studio-app
SE=~/source/spatial-editor-studio/packages/spatial-editor-studio
NODE_ENV=development STUDIO_DEV_MODE=1 STUDIO_DEV_BUILD=1 \
STUDIO_PRERELEASE_MODE=1 IMJS_URL_PREFIX=qa- \
  ./node_modules/.bin/electron lib/node/root/root.js \
  $CURTIS/app.config.json --loadLocalApp=$CURTIS --loadLocalApp=$SE
```

Terminal 3 (instance B): the same command, plus `--profile wod-b --useProfileDebugChannels`.

Open the same iModel in both.

## What to check

1. **Both open read-only.** Log: `Spike: opened write-on-demand` with `isReadonly: true`, `canBecomeWritable: true`.
2. **Edit in A.** Spatial Editor, Transformation widget, move and save. Expect a toast "briefcase is read-write", then about 0.5 s after the save, "briefcase is read-only". Backend log: `Write-on-demand: switched to read-write` / `switched back to read-only`.
3. **B shows A's change** without a reload (watcher).
4. **Edit in B while A is idle.** Same as step 2, in B. A shows B's change.
5. **Edit in B while A holds read-write.** Open the project extents tool in A (it keeps a graphical editing scope open, so A stays read-write). Then edit in B. Expect B's edit to fail after about 0.5 s with "This briefcase is open for writing in another process". B stays usable.
6. **Undo.** After a save and the switch back, try undo (Ctrl+Z) in the instance that made the change. Expected from the node test: nothing to undo (see findings).
7. **Push.** Push from A after B made a change. Expected: A pushes both changes (shared briefcase).

## Findings from the node test (two processes, local file)

Run: `node ../../spike-write-on-demand/wod-test.js $PWD/../.. A` from `core/backend`.

- Switch read-only → read-write in place: 15–30 ms. Switch back: 15–30 ms.
- A second process that writes while the first holds read-write fails in about 0.56 s (`busyTimeout` 500) with a clear error, and stays read-only and usable.
- After the first process switches back, the second writes in about 20 ms.
- The read-only process sees the other process's saves through the watcher.
- **Undo is lost on every switch back.** Each reopen starts a new txn session, so `reverseSingleTxn` returns `NothingToUndo` for txns saved before the switch back, including the process's own. This also means one process cannot undo another process's change.
- The watcher reload in the read-only process logs `attempt to write a readonly database` for `UPDATE dgn_Txns` (same as the earlier spike).

## Findings from the Studio test

- **App `isReadonly` checks block the trigger.** Spatial Editor's `TransformEditCommand.save` checks `iModel.isReadonly` and returns "iModel is readonly" before it writes. Fix in the spike: a write-on-demand briefcase reports `isReadonly === false` (backend and frontend). The real file mode is internal (`canBecomeWritable`).
- **The switch back fired during a push.** The switch back only waited for EditTxns, editing scopes, and unsaved changes. A push started 0.5 s after the save, and the file was reopened read-only in the middle of it (`db is not open for write`). Fix: push and pull count as work in progress.
- **Stale iModel properties in the other process.** The `watchForChanges` reload (and the in-place reopen) did not refresh cached iModel properties: project extents, ECEF, global origin, GCS, name. The other window saw moved elements but kept the old project extents, so the model was cut off. This also affects plain `watchForChanges` (the ADR's read-only fallback), as far as the code shows. Fix: call `_refreshIModelProps()` after each reload and reopen; this raises the change events, so the frontend updates too. Node test: `spike-write-on-demand/wod-extents.js`.
- **Slow first open (74 s)** was the GCS workspace download over a slow network, not the spike (inferred from the log order).

## Follow-up (later): stale iModel properties under `watchForChanges`

- Likely an upstream iTwin.js bug, not a host problem. `watchForChanges` promises to reflect the other connection's changes; pull already calls `_refreshIModelProps()`, the watcher does not. Hosts cannot fix it well (`_refreshIModelProps` is internal, and the frontend needs the change events).
- Proposed fix location: `TxnManager._onReplayedExternalTxns`, so every replay path refreshes, not only the `fs.watch` callback.
- To check before filing:
  1. Rerun `wod-extents.js` with plain `watchForChanges: true` on stock 5.15.0 (no spike) to prove the bug exists without our changes.
  2. Confirm that `_onReplayedExternalTxns` fires on the watcher's `restartDefaultTxn()`.
- Then draft the iTwin.js issue with that repro.

## Unrelated: Spatial Editor

The model sometimes disappears while rotating around Z, and appears again after a zoom. Filed as https://github.com/iTwin/spatial-editor-studio/issues/639.
