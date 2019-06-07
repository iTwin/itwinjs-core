# App backend supported platforms
Bentley **backends** are built and tested on the following:
- Windows 10 version 1803 (or greater)
- Debian 9 "Stretch"

In addition, **backends** are deployed on:
- Windows Server 2016 Datacenter version 1607

imodeljs **backends** should run on most Windows and Linux platforms that nodejs provides [Tier 1 support](https://github.com/nodejs/node/blob/master/BUILDING.md#platform-list) for. However, regular testing only occurs on the platforms listed above.

### Backend Prerequisites
- Windows
    - [Visual Studio 2017 C Runtime](https://support.microsoft.com/en-us/help/2977003/the-latest-supported-visual-c-downloads)
- Linux
    - GLIBC 2.24 (or greater)
    - GLIBCXX 3.4.22 (or greater)
