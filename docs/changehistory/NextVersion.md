---
publish: false
---

# NextVersion

Table of contents:

- [Quantity](#quantity)
- [Electron 32 support](#electron-32-support)

## Quantity

- The `minWidth` property on FormatProps now works as documented.
- The `spacer` property on FormatProps now indicates the space used between composite components, it defaults to a single space, and there is no longer a ':' prepended. If a ':' spacer is desired, `spacer` has to be set accordingly. This is to streamline the behavior with the documentation and native APIs.
- Added support for bearing and azimuth format types (e.g. bearing `N45°30'10"E`). A new phenomenon "Direction" for these will be added to our units library soon, but they work just as well with the angle phenomenon for now. Persistence values for both bearing and azimuth are to be provided counter-clockwise from an east-base (inspired by PowerPlatform).
- [Electron 32 support](#electron-32-support)

## Electron 32 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 32](https://www.electronjs.org/blog/electron-32-0).
