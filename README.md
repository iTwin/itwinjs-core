# imodeljs-core

Copyright © Bentley Systems, Inc. 2018

iModelJs extends the iModel technology stack to provide a JavaScript library (built using [TypeScript](https://www.typescriptlang.org/)) for querying, displaying, and modifying iModels.
It can be used to build:

* Backend agents and other web services
* Web applications with browser frontends
* Desktop applications that use web UI frameworks
* Mobile applications that use web UI frameworks

imodeljs-core is the name of the overall git repository.
The source code is organized according to where it can run:

| Directory            | Design Requirements |
|----------------------|---------------------|
| source/backend/      | Designed for backend requirements. Runs in a standalone JavaScript engine (Node in this case). May have file system and Node dependencies  |
| source/backend/test/ | Specific for unit tests. The test framework puts the frontend and backend together in a single executable. |
| source/frontend/     | Designed for frontend requirements. Must be able to run in a web browser. Cannot have file system or Node dependencies. |
| source/common/       | Design to run either in frontend or backend. Must adhere to frontend restrictions. |
| source/gateway/      | Configures how the frontend talks to the backend. This source code is used by both the frontend and backend. |
| source/testbed/      | Used for testing the frontend, but includes a test backend and test gateway |

## Prerequisites

* **Node**: an installation of the latest security patch of Node 8.9.x downloaded from [nodejs.org](https://nodejs.org/en/). The Node installation also includes the **npm** package manager.
* **rush**: to install `npm install -g @microsoft/rush`, for more information see: [Rush](https://github.com/Microsoft/web-build-tools/wiki/Rush)
* **Visual Studio Code**: an optional dependency, but the repository structure is optimized for use with [Code](https://code.visualstudio.com/).

## Authentication

Configure npm and log in to the Bentley npm registry with the following commands:

```cmd
npm config set @bentley:registry https://npm.bentley.com/npm/npm/
```

## Build Instructions

1. Clone repository (first time) with `git clone` or pull updates to the repository (subsequent times) with `git pull`
2. Install dependencies: `rush install`
3. Clean: `rush clean`
4. Rebuild source: `rush rebuild`
5. Run tests: `npm test -s`

The `-s` option is short for `--silent` which results in a less verbose command.
That part of the command is optional depending on the desired verbosity level.

Note that all build instructions are designed to run from the imodeljs-core root directory.
The individual commands orchestrate separate backend, frontend, and test steps as required.

Note that it is a good idea to `rush install` after each `git pull` as dependencies may have changed.

## Migrating to New Build Instructions

Now, [Rush](https://github.com/Microsoft/web-build-tools/wiki/Rush) takes over the **install** and **build** steps.

| Build step           | New Command      | Old Command      |
|----------------------|------------------|------------------|
| Install dependencies | rush install     | npm install      |
| Check dependencies   | rush check       | N/A              |
| Clean output         | rush clean       | npm run clean    |
| Rebuild source       | rush rebuild     | npm run build -s |
| Incremental build    | rush build       | N/A              |
| Run tests            | npm test -s      | npm test -s      |
| Run lint rules       | npm run lint -s  | npm run lint -s  |

## Updating dependencies/devDependencies

1. Edit the appropriate `package.json` file to update the semantic version range
2. Run `rush check` to make sure that you are specifying consistent versions across the repository
3. Run `rush install` to make sure the newer version of the module specified in #1 is installed

## Other NPM Scripts

1. Build TypeDoc documentation for all packages: `npm run docs`
2. Build TypeDoc documentation for frontend, backend, or common only: `npm run docs:frontend`, `npm run docs:backend`, `npm run docs:common` from top-level directory or `npm run docs` from package directory
3. Extract sample code from test directory (run automatically as a *pre* step by the TypeDoc build command above): `npm run extract`
4. Run code coverage for the frontend, backend and common folders using the tests (coverage output to source/test/lib/coverage) : `npm run cover`

The full list of npm scripts can be found in the root `package.json` file.

## Managing the packages in the imodeljs-core repository

The imodeljs-core repository is a *monorepo*.
That is, multiple packages are managed within a single git repository.
See [rush.json](./rush.json) for the list of packages.
Also, these packages are described below:

* `package.json`
  * Private, not published
  * Provides the npm scripts to work with this repository
  * Identifies the overall devDependencies (union of backend, frontend, and test devDependencies). Many devDependencies are in common between backend and frontend, so consolidating them makes them easier to manage.
* `source/backend/package.json`
  * Controls the version number for **@bentley/imodeljs-backend**
  * Controls the backend package dependencies
* `source/frontend/package.json`
  * Controls the version number for and dependencies of **@bentley/imodeljs-frontend**
  * Controls the frontend package dependencies
* `source/testbed/package.json`
  * Private, not published
  * Testbed application for testing frontend/backend interaction

### Installing dependencies and devDependencies

The single `rush install` command run at the root of the repository installs devDependencies at the root and iterates into backend, frontend, and testbed to install dependencies.
After a successful install, you will notice multiple **node_modules** directories:

| node_modules Directory        | Contents                |
|-------------------------------|-------------------------|
| node_modules/                 | Overall devDependencies |
| source/backend/node_modules/  | Backend dependencies    |
| source/frontend/node_modules/ | Frontend dependencies   |
| source/testbed/node_modules/  | Testbed dependencies    |

With Rush, the node_modules directories listed above are symlinks to a *common* package managed by Rush.

## Build Output and Publishing

| Output Directory     | Published As      |
|----------------------|-------------------|
| source/backend/lib/  | imodeljs-backend  |
| source/frontend/lib/ | imodeljs-frontend |

Note that imodeljs-core/source/common/ is built into both the **imodeljs-backend** and **imodeljs-frontend** packages.
Note that these packages are published by Bentley CI builds only.
