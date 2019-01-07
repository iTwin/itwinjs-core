---
ignore: true
---
# NextVersion

The iModel.js backend now requires [Node version 10](https://nodejs.org) or later. If you run the backend, please install it before running this version.

If you build the iModel.js packages from the monorepo, you should follow these steps:

1) `rush clean`
1) `rush unlink`
1) uninstall current version of Node (on Windows, via "add or remove programs")
1) install latest version of Node 10
1) `npm install -g @microsoft/rush`
1) `git pull`
1) `rush install`
   - if you get an error about npm versions, do `npm uninstall -g npm`
1) `rush build`
1) `rush test`
