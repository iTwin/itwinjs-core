---
publish: false
---
# NextVersion

Table of contents:

- [Electron 27 support](#electron-27-support)
- Inserting,updating & deleting aspect require exclusive lock on the element that owns the aspect

## Electron 27 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 27](https://www.electronjs.org/blog/electron-27-0).

## Inserting,updating & deleting aspect require exclusive lock on the element that owns the aspect

This is new requirement to prevent certain changesets from being pushed that will not apply.
