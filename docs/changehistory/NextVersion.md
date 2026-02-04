---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [Electron 40 support](#electron-40-support)
  - [Quantity Formatting](#quantity-formatting)
    - [Updated default engineering lengths in QuantityFormatter](#updated-default-engineering-lengths-in-quantityformatter)

## Electron 40 support

In addition to [already supported Electron versions](../learning/SupportedPlatforms.md#electron), iTwin.js now supports [Electron 40](https://www.electronjs.org/blog/electron-40-0).

Note: with Electron 40, Chromium no longer uses [SwiftShader](https://github.com/google/swiftshader) as an automatic fallback for WebGL. This may cause issues when Electron is run in an environment without a supported GPU. For more information: [Using Chromium with SwiftShader](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/gpu/swiftshader.md#automatic-swiftshader-webgl-fallback-is-deprecated).

## Quantity Formatting

### Updated default engineering lengths in QuantityFormatter

For applications and tools using [QuantityFormatter]($frontend) and [QuantityType]($frontend) APIs, the default engineering length formatting, retrieved via `QuantityType.LengthEngineering` has been updated. Metric engineering lengths now use millimeters with 3 decimal places; imperial engineering lengths use feet with 2 decimal places.
