# Supported Platforms

## Backends

iTwin.js **backends** are built and tested on the following:

- Debian 10 "Buster" and Debian 11 "Bullseye"
- Windows 10 version 1803 (or greater)
- MacOS 10.15 (or greater)

They should run on most Windows, Linux and MacOS versions with [Tier 1 support](https://github.com/nodejs/node/blob/master/BUILDING.md#platform-list) from Node.js. However, regular testing only occurs on the platforms listed above.

### Supported Node.js Versions

The following Node.js versions are officially supported by the iTwin.js backend code.

> The minimum requirements are driven by Node's compatibility with a specific N-API version. iTwin.js currently requires N-API version 8. See the [Node compatibility matrix](https://nodejs.org/api/n-api.html#n_api_node_api_version_matrix) for more details.

| iTwin.js - Node Support | iTwin.js 1.x | iTwin.js 2.x | iTwin.js 3.x | iTwin.js 4.x |
| ----------------------- | ------------ | ------------ | ------------ | ------------ |
| Node 18                 | ❌           | ❌           | ✅ (>= 3.5) | ✅          |
| Node 16 (>=16.13)       | ❌           | ❌           | ✅          | ✅          |
| Node 14 (>=14.17)       | ❌           | ✅ (>= 2.13) | ✅          | ❌          |
| Node 12 (>=12.22)       | ✅           | ✅           | ✅          | ❌          |
| Node 10                 | ❌           | ❌           | ❌          | ❌          |

### Backend Prerequisites

| Operating System | Architectures | Versions                                                                                                           | Notes           |
| ---------------- | ------------- | ------------------------------------------------------------------------------------------------------------------ | --------------- |
| Linux            | all           | GLIBC >= 2.24, GLIBCXX >= 3.4.22                                                                                   |                 |
| Windows          | all           | [Visual Studio 2017 C Runtime](https://support.microsoft.com/help/2977003/the-latest-supported-visual-c-downloads) |                 |
| macOS            | x64           | >= 10.15                                                                                                           |                 |
| macOS            | arm64         | >= 11                                                                                                              | >= iTwin.js 3.3 |

## Supported Browsers

iTwin.js strives to support as many modern browsers as possible, though it requires complete JavaScript ES6 support. The quality of the web browser's WebGL implementation has a substantial impact on display performance.

- Chrome (recommended for development)
- Firefox
- Safari
- Opera
- "New" [Chromium-based](https://www.microsoft.com/edge) Edge

> Note: Internet Explorer and "Old" Edge are **not** supported

> Note: Other Chromium-based browsers will likely work fine, but are untested.

## Electron

- Windows

## Mobile Native

The following minimum versions of mobile operating systems are supported:

- iOS 13: Minimum supported [iPhones](https://support.apple.com/guide/iphone/supported-iphone-models-iphe3fa5df43/13.0/ios/13.0) and [iPads](https://support.apple.com/guide/ipad/supported-models-ipad213a25b2/13.0/ipados/13.0)
- Android 9.0 (API Level 28)
