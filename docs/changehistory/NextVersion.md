---
publish: false
---

# NextVersion

Table of contents:

- [Workspaces](#workspaces)
- [Electron 31 support](#electron-31-support)
- [`ListenerType` helper](#listenertype-helper)

## Workspaces

The `beta` [Workspace]($backend) and [Settings]($backend) APIs have been updated to make them easier to use, including the addition of the [WorkspaceEditor]($backend) API for creating new [WorkspaceDb]($backend)s to hold workspace resources. Consult the [learning article](../learning/backend/Workspace) for a comprehensive overview with examples.

## Electron 31 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 31](https://www.electronjs.org/blog/electron-31-0).

## `ListenerType` helper

Added a new helper type [ListenerType]($core-bentley) to retrieve the listener type of a [BeEvent]($core-bentley). This type is useful when implicit types can not be used i.e. you need to define a listener outside of [BeEvent.addListener]($core-bentley).
