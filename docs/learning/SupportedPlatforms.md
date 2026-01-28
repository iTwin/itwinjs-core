# Supported Platforms

## Backends

iTwin.js **backends** are built and tested on the following:

- Arch Linux
- Debian 11 "Bullseye"
- Windows 10 version 1803 (or greater)
- MacOS 10.15 (or greater)

They should run on most Windows, Linux and MacOS versions with [Tier 1 support](https://github.com/nodejs/node/blob/master/BUILDING.md#platform-list) from Node.js. However, regular testing only occurs on the platforms listed above.

### Supported Node.js Versions

The following Node.js versions are officially supported by the iTwin.js backend code.

| iTwin.js - Node Support | iTwin.js 3.x | iTwin.js 4.x | iTwin.js 5.x |
| ----------------------- | ------------ | ------------ | ------------ |
| Node 24 (>=24.11)       | ❌           | ❌           | ✅ (>= 5.4)  |
| Node 22 (>=22.11)       | ❌           | ✅ (>= 4.10) | ✅           |
| Node 20 (>=20.18)       | ❌           | ✅ (>= 4.3)  | ✅           |
| Node 18 (>=18.12)       | ✅ (>= 3.5)  | ✅           | ❌           |
| Node 16 (>=16.13)       | ✅           | ❌           | ❌           |
| Node 14 (>=14.17)       | ✅           | ❌           | ❌           |
| Node 12 (>=12.22)       | ✅           | ❌           | ❌           |
| Node 10                 | ❌           | ❌           | ❌           |

### Supported iTwin.js versions

For supported versions of iTwin.js, please refer to [Version support status](./api-support-policies.md#version-support-status)

### Backend Prerequisites

| Operating System | Architectures | Versions                                                                                                                                                                       | Notes           |
| ---------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| Linux            | x64           | GLIBC >= 2.36, GLIBCXX >= 3.4.30                                                                                                                                               |                 |
| Windows          | x64           | [Visual Studio 2022 Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170#latest-microsoft-visual-c-redistributable-version) |                 |
| macOS            | x64           | **Discontinued in iTwin.js 5.0**                                                                                                                                               |                 |
| macOS            | arm64         | >= 14                                                                                                                                                                          | >= iTwin.js 3.3 |

## Supported Browsers

iTwin.js strives to support as many modern browsers as possible, though it requires JavaScript ES2023 support. The quality of the web browser's WebGL implementation has a substantial impact on display performance.

- Chrome (recommended for development)
- Firefox
- Safari
- Opera
- "New" [Chromium-based](https://www.microsoft.com/edge) Edge

> Note: Internet Explorer and "Old" Edge are **not** supported

> Note: Other Chromium-based browsers will likely work fine, but are untested.

## Electron

To enable the development of desktop applications, iTwin.js supports the latest Electron releases. As of iTwin.js 5.0, Electron 35 is the minimum requirement. See [Electron platform requirements](https://github.com/electron/electron/#platform-support) for supported Windows, Linux and MacOS versions.

## Mobile Native

The following minimum versions of mobile operating systems are supported:

- iOS 17: Minimum supported [iPhones](https://support.apple.com/guide/iphone/supported-models-iphe3fa5df43/17.0/ios/17.0) and [iPads](https://support.apple.com/guide/ipad/supported-models-ipad213a25b2/17.0/ipados/17.0)
- Android 12.0 (API Level 31)
