<p align="center">
 <a href="https://www.itwinjs.org/" target="_blank" rel="noopener noreferrer">
    <img width="180" src="./docs/assets/itwinjs-logo-colorized.svg" alt="iTwin.js Logo">
  </a>
</p>

<h1 align="center">
iTwin.js
</h1>
<p align="center">
    <a href="https://github.com/iTwin/itwinjs-core/releases/latest"><img src="https://img.shields.io/github/v/release/iTwin/itwinjs-core?label=latest" alt="Latest version"></a>
    <a href="https://nodejs.org/en/about/previous-releases">
    <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fgithub.com%2FiTwin%2Fitwinjs-core%2Fraw%2Fmaster%2Frush.json&query=%24.nodeSupportedVersionRange&label=node&color=33a921"
    alt="Supported Node Versions">
    </a>
</a>
<p align="center">
An open source library for creating, querying, modifying, and displaying Infrastructure Digital Twins.
</p>

## About this Repository

[![Build status](https://dev.azure.com/imodeljs/imodeljs/_apis/build/status/iModel.js)](https://dev.azure.com/imodeljs/imodeljs/_build/latest?definitionId=12)

This repository is a [monorepo](https://en.wikipedia.org/wiki/Monorepo) that holds the source code to multiple iTwin.js npm packages. It is built using [Rush](http://rushjs.io/).

See [rush.json](./rush.json) for the complete list of packages and [Versioning.md](./Versioning.md) for package and API versioning policies.

## Prerequisites

- [Git](https://git-scm.com/)
- [Node](https://nodejs.org/en/): an installation of the latest security patch of Node 20. The Node installation also includes the **npm** package manager.
- [pnpm](https://pnpm.io/): our required package manager. It is more performant and monorepo friendly than `npm`. We recommend installing `pnpm` using [`corepack enable pnpm`](https://pnpm.io/installation#using-corepack). Note you may have to use an administrator shell to run the command.
- [Rush](https://github.com/Microsoft/web-build-tools/wiki/Rush): to install `npm install -g @microsoft/rush`
- [TypeScript](https://www.typescriptlang.org/): this is listed as a devDependency, so if you're building it from source, you will get it with `rush install`.
- [Visual Studio Code](https://code.visualstudio.com/): an optional dependency, but the repository structure is optimized for its use

> See [supported platforms](./docs/learning/SupportedPlatforms.md) for further information.


## Contribution

If you have questions, or wish to contribute to iTwin.js, see our [Contributing guide](./CONTRIBUTING.md).

## Licensing

Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](./LICENSE.md) for license terms and full copyright notice.
