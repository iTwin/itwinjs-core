# Supported Platforms

## Backends

iTwin.js **backends** are built and tested on the following:

- Debian 9 "Stretch" and Debian 10 "Buster"
- Windows 10 version 1803 (or greater)
- MacOS 10.15 (or greater)

They should run on most Windows, Linux and MacOS versions with [Tier 1 support](https://github.com/nodejs/node/blob/master/BUILDING.md#platform-list) from Node.js. However, regular testing only occurs on the platforms listed above.

### Supported Node.js Versions

The following Node.js versions are officially supported by the iTwin.js backend code.

> The minimum requirements are driven by Node's compatibility with a specific N-API version. iTwin.js currently requires N-API version 8. See the [Node compatibility matrix](https://nodejs.org/api/n-api.html#n_api_node_api_version_matrix) for more details.

| Node Version | Supported |
| - | - |
| Node >=14.17 | ✔️ |
| Node 12 (>=12.22) | ✔️ |
| Node <12.22 | ❌ |
| Node 10.x* | ❌ |

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
