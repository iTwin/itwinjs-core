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

Each package has its own **node_modules** directory that contains symbolic links to _common_ dependencies managed by Rush.

## Features

- ✅ Create infrastructure digital twins of assets or projects
- ✅ Aggregate Engineering Models, Reality Data, Geographic Information Systems, Internet of Things (IoT) Data, and other standard formats
- ✅ Visualize data and engineering changes in 3D and 4D
- ✅ Analyze data to gain insights and drive new business outcomes across multiple platforms

## Quick Start

- This is a [sample](https://www.itwinjs.org/sandboxes/iTwinPlatform/3d%20Viewer) of an iTwin viewer - a frontend application that displays infrastructure projects on browsers. It uses many of the APIs and libraries published from this repository.
- You can also look at [other samples](https://developer.bentley.com/samples/) which showcases the capabilities of iTwin.js, and the iTwin Platform.

## Prerequisites

- [Git](https://git-scm.com/)
- [Node](https://nodejs.org/en/): an installation of the latest security patch of Node 24. The Node installation also includes the **npm** package manager.
- [pnpm](https://pnpm.io/): our required package manager. It is more performant and monorepo friendly than `npm`. We recommend installing `pnpm` using [`corepack enable pnpm`](https://pnpm.io/installation#using-corepack). Note you may have to use an administrator shell to run the command.
- [Rush](https://github.com/Microsoft/web-build-tools/wiki/Rush): to install `npm install -g @microsoft/rush`
- [TypeScript](https://www.typescriptlang.org/): this is listed as a devDependency, so if you're building it from source, you will get it with `rush install`.
- [Visual Studio Code](https://code.visualstudio.com/): an optional dependency, but the repository structure is optimized for its use

> See [supported platforms](./docs/learning/SupportedPlatforms.md) for further information.

## Contribution

### Developer Quick Start

The following instructions will quickly set the repo up for you to edit the source code and contribute:

1. Clone the repository locally: `git clone https://github.com/iTwin/itwinjs-core.git`
2. Install dependencies: `rush install`
3. Build source: `rush build`
4. Run tests: `rush cover`

​For more information, please refer to our [Contributing Guide](./CONTRIBUTING.md), which provides detailed instructions on source code editing workflows, debugging tests, contribution standards, FAQs, and guidelines for posting questions.​

## Interactive Testing and Feature Development

This repository includes [display-test-app](./test-apps/display-test-app/README.md) (DTA), a desktop-style test application built as part of the monorepo. It is the easiest way to exercise iTwin.js APIs directly against the source code in this repository — for example, to reproduce a bug, demonstrate a feature gap, or test a local change. Because it runs against the code in your working tree (not a published release), it is often a better vehicle for reproductions than online sandboxes, and as an Electron app it can also exercise desktop-only workflows such as editing.

### Build and run

After completing the [Developer Quick Start](#developer-quick-start) above (which builds display-test-app along with everything else):

```sh
cd test-apps/display-test-app
npm run start            # run as an Electron app
# or
npm run start:servers    # run in a browser at http://localhost:3000
```

display-test-app opens iModel snapshot and briefcase files from the local file system — use the toolbar's open-file button, or set the `IMJS_STANDALONE_FILENAME` environment variable to the absolute path of an iModel to open it automatically at startup (e.g., in `test-apps/display-test-app/.env.local`). If you don't have an iModel handy, a small sample is included in the repository at [test-apps/display-test-app/test-models/JoesHouse.bim](./test-apps/display-test-app/test-models/JoesHouse.bim). See the [display-test-app README](./test-apps/display-test-app/README.md) for the full list of environment variables, UI documentation, and debugging instructions.

### Calling iTwin.js APIs from display-test-app

Much of display-test-app's functionality is driven by **key-ins** — commands typed into its key-in field (press the backtick key to focus it). Adding a new key-in that calls whatever iTwin.js API you want to test is a convenient, self-contained way to build a reproduction that others can run. See [Adding a key-in](./test-apps/display-test-app/README.md#adding-a-key-in) for a step-by-step guide with a skeletal example.

## Licensing

Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](./LICENSE.md) for license terms and full copyright notice.
