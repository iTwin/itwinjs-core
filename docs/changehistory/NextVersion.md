---
publish: false
---

# NextVersion

Table of contents:

- [API deprecations](#api-deprecations)
  - [@itwin/presentation-common](#itwinpresentation-common)
- [Breaking changes](#breaking-changes)
  - [Opening connection to local snapshot requires IPC](#Opening-connection-to-local-snapshot-requires-IPC)

## API deprecations

### @itwin/presentation-common

- All public methods of [PresentationRpcInterface]($presentation-common) have been deprecated. Going forward, RPC interfaces should not be called directly. Public wrappers such as [PresentationManager]($presentation-frontend) should be used instead.

- [Breaking Changes](#breaking-changes)
  - [Opening connection to local snapshot requires IPC](#opening-connection-to-local-snapshot-requires-ipc)

## Breaking Changes

### Opening connection to local snapshot requires IPC

[SnapshotConnection.openFile]($frontend) now requires applications to have set up a valid IPC communication. If you're using this API in an Electron or Mobile application, no additional action is needed as long as you call `ElectronHost.startup` or `MobileHost.startup` respectively. This API shouldn't be used in Web applications, so it has no replacement there.
