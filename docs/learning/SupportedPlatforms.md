# Supported Platforms

## Backends

iTwin.js **backends** are built and tested on the following:

- Debian 9 "Stretch"
- Windows 10 version 1803 (or greater)
- MacOS 10.15 (or greater)

In addition, **backends** are deployed on:

- Windows Server 2016 Datacenter version 1607

They should run on most Windows, Linux and MacOS versions with [Tier 1 support](https://github.com/nodejs/node/blob/master/BUILDING.md#platform-list) from NodeJs. However, regular testing only occurs on the platforms listed above.

### Backend Prerequisites

- Linux
  - GLIBC 2.24 (or greater)
  - GLIBCXX 3.4.22 (or greater)
- Windows
  - [Visual Studio 2017 C Runtime](https://support.microsoft.com/help/2977003/the-latest-supported-visual-c-downloads)

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

- Not yet supported
