---
publish: false
---

# NextVersion

- [Breaking Changes](#breaking-changes)
  - [Opening connection to local snapshot requires IPC](#opening-connection-to-local-snapshot-requires-ipc)

## Breaking Changes

### Opening connection to local snapshot requires IPC

[SnapshotConnection.openFile]($frontend) now requires applications to have set up a valid IPC communication. If you're using this API in an Electron or Mobile application, no additional action is needed as long as you call `ElectronHost.startup` or `MobileHost.startup` respectively. This API shouldn't be used in Web applications, so it has no replacement there.
