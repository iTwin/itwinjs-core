# The iModelJs Library

Copyright © Bentley Systems, Inc. 2018

The iModelJs library is an open source library for creating and accessing iModels.

## Getting Started With iModelJs

* [This Overview](./docs/index) explains the purpose and organization of the library.
* [These Tutorials](./docs/tutorials/index) provide examples of its use.
* The [API Documentation](./api/) gives details of the classes and functions.
* [Additional Resources](./docs/overview/CommunityResources) are available to ask questions and get further help.
* [Release Notes](./ReleaseNotes) describes changes from previous versions.
* [Contributions](./Contributing) to iModelJs are welcome.

## About this Repository

This repository is a *monorepo* that holds the source code to several iModelJs npm packages. It is built using [Rush](http://rushjs.io/).

See [rush.json](./rush.json) for the list of packages. These packages are described below:

* `package.json`
  * Private, not published
  * Provides the npm scripts to work with this repository
  * Identifies the overall devDependencies (union of backend, frontend, and test devDependencies). Many devDependencies are in common between backend and frontend, so consolidating them makes them easier to manage.
* `core/bentley/package.json`
  * Controls the version number and package dependencies for **@bentley/bentleyjs-core**
* `core/geometry/package.json`
  * Controls the version number and package dependencies for **@bentley/geometry-core**
* `core/common/package.json`
  * Controls the version number for **@bentley/imodeljs-common**
  * Controls the package dependencies for the source code in common to both the backend and frontend
* `core/backend/package.json`
  * Controls the version number and package dependencies for **@bentley/imodeljs-backend**
* `core/frontend/package.json`
  * Controls the version number and package dependencies for **@bentley/imodeljs-frontend**
* `testbed/package.json`
  * Private, not published
  * Testbed application for testing frontend/backend interaction

## Prerequisites

* [Git](https://git-scm.com/)
* [Node](https://nodejs.org/en/): an installation of the latest security patch of Node 8.9.x. The Node installation also includes the **npm** package manager.
* [Rush](https://github.com/Microsoft/web-build-tools/wiki/Rush): to install `npm install -g @microsoft/rush`
* [Visual Studio Code](https://code.visualstudio.com/): an optional dependency, but the repository structure is optimized for its use

## (Bentley Developers only) Authentication

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

## Updating dependencies/devDependencies

1. Edit the appropriate `package.json` file to update the semantic version range
2. Run `rush check` to make sure that you are specifying consistent versions across the repository
3. Run `rush install` to make sure the newer version of the module specified in #1 is installed

## Other NPM Scripts

1. Build TypeDoc documentation for all packages: `npm run docs`
2. Build TypeDoc documentation for frontend, backend, or common only: `npm run docs:frontend`, `npm run docs:backend`, `npm run docs:common` from top-level directory or `npm run docs` from package directory
3. Extract sample code from test directory (run automatically as a *pre* step by the TypeDoc build command above): `npm run extract`

The full list of npm scripts can be found in the root `package.json` file.

### Installing dependencies and devDependencies

The single `rush install` command run at the root of the repository installs devDependencies at the root and iterates into common, backend, frontend, and testbed to install dependencies.
After a successful install, you will notice multiple **node_modules** directories:

| node_modules Directory      | Contents                |
|-----------------------------|-------------------------|
| node_modules/               | Overall devDependencies
| core/bentley/node_modules/  | @bentley/bentleyjs-core dependencies
| core/geometry/node_modules/ | @bentley/geometry-core dependencies
| core/common/node_modules/   | @bentley/imodeljs-common dependencies
| core/backend/node_modules/  | Backend dependencies
| core/frontend/node_modules/ | Frontend dependencies
| testbed/node_modules/       | Testbed dependencies

With Rush, the node_modules directories listed above are symbolic links to a *common* package managed by Rush.

Note that the packages are published by CI builds only.
