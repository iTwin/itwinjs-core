---
publish: false
---

# NextVersion

Table of contents:

- [Workspaces](#workspaces)
- [Electron 31 support](#electron-31-support)
- [Internal APIs](#internal-apis)

## Workspaces

The `beta` [Workspace]($backend) and [Settings]($backend) APIs have been updated to make them easier to use, including the addition of the [WorkspaceEditor]($backend) API for creating new [WorkspaceDb]($backend)s to hold workspace resources. Consult the [learning article](../learning/backend/Workspace) for a comprehensive overview with examples.

## Electron 31 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 31](https://www.electronjs.org/blog/electron-31-0).

# Internal APIs

iTwin.js categorizes the stability of each API using [release tags](../learning/api-support-policies.md#api-categories) like `@public`, `@beta`, and `@internal`. `@internal` APIs are intended strictly for use inside of the itwinjs-core repository. They can be tricky to use correctly, and may be changed or removed at any time, so consumers of iTwin.js should not write code that depends on them. Unfortunately, up until now they have been exported from the iTwin.js core packages just like any other type of APIs, making it easy for anyone to accidentally or intentionally introduce a dependency on them. To ensure that we can adhere to our commitment to providing stable libraries, we have begun to transition to a new approach to handling these kinds of APIs.

The [details](../learning/guidelines/release-tags-guidelines.md) are relevant primarily to contributors, but consumers should expect to find that `@internal` APIs they currently depend upon have been marked as deprecated. The deprecation messages include information about alternative public APIs to use instead, where appropriate. If you encounter a dependency on an `@internal` API which you struggle to remove, please [let us know](https://github.com/orgs/iTwin/discussions). Beginning in iTwin.js 5.0, you will no longer be able to access any `@internal` APIs.
