# Rush bootstrap lockfile

`update-changelogs.mjs` sets `INSTALL_RUN_RUSH_LOCKFILE_PATH` to `package-lock.json` in this
directory. That makes `common/scripts/install-run-rush.js` run `npm ci` instead of a ranged
`npm install` when it bootstraps Rush during the finalize-release workflow, which runs with a
token that can push to protected branches. `npm ci` only installs exactly what's recorded here,
so a compromised/republished transitive dependency of Rush can't get pulled in and executed at
release time.

The script also asserts this lockfile's pinned `@microsoft/rush` version matches `rushVersion` in
`rush.json` before it runs Rush, and fails the release if they've drifted apart.

## Regenerating after a `rushVersion` bump

Whenever `rush.json`'s `rushVersion` changes, regenerate this lockfile in the same PR:

```sh
rm -rf /tmp/rush-lockfile-gen && mkdir /tmp/rush-lockfile-gen && cd /tmp/rush-lockfile-gen
cat > package.json << 'EOF'
{
  "name": "ci-rush",
  "version": "0.0.0",
  "dependencies": {
    "@microsoft/rush": "<rushVersion from rush.json>"
  },
  "description": "DON'T WARN",
  "repository": "DON'T WARN",
  "license": "MIT"
}
EOF
npm install --package-lock-only
cp package-lock.json <repo>/.github/workflows/automation-scripts/rush-lockfile/package-lock.json
```

Review the diff (new/changed transitive dependencies) before committing, the same as any other
dependency update.
