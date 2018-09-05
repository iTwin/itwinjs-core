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
* `core/bentley/package.json`
  * Controls the version number and package dependencies for **@bentley/bentleyjs-core**
* `core/geometry/package.json`
  * Controls the version number and package dependencies for **@bentley/geometry-core**
* `core/common/package.json`
  * Controls the version number for **@bentley/imodeljs-common**
  * Controls the package dependencies for the source code in common to both the backend and frontend
* `core/backend/package.json`
  * Controls the version number and package dependencies for **@bentley/imodeljs-backend**
* `core/clients/package.json`
  * Controls the version number and package dependencies for **@bentley/imodeljs-clients**
* `core/frontend/package.json`
  * Controls the version number and package dependencies for **@bentley/imodeljs-frontend**
* `core/i18n/package.json`
  * Controls the version number and package dependencies for **@bentley/imodeljs-i18n**
* `core/ecschema-metadata`
  * Comprehensive ECSchema library
* `example-code`
  * Example code snippets are extracted from these packages
* `test-apps/simpleviewtest/package.json`
  * Private, not published
  * Test application for graphics visualization
* `test-apps/testbed/package.json`
  * Private, not published
  * Test application for frontend/backend interaction

Each package will have its own **node_modules** directory which will contain symbolic links to *common* dependencies managed by Rush.

## Prerequisites

* [Git](https://git-scm.com/)
* [Node](https://nodejs.org/en/): an installation of the latest security patch of Node 8.11.x. The Node installation also includes the **npm** package manager.
* [Rush](https://github.com/Microsoft/web-build-tools/wiki/Rush): to install `npm install -g @microsoft/rush`
* [TypeScript](https://www.typescriptlang.org/): this is listed as a devDependency, so if you're building it from source, you will get it with `rush install`. Currently we're using version 2.7.2
* [Visual Studio Code](https://code.visualstudio.com/): an optional dependency, but the repository structure is optimized for its use

### Linux

You must install the following on a Linux computer before attempting to run imodeljs-backend:

* libc++abi1

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
The above commands iterate and perform their action against each package in the monorepo.

For incremental builds, the `rush build` command can be used to only build packages that have changes versus `rush rebuild` which always rebuilds all packages.

Note that it is a good idea to `rush install` after each `git pull` as dependencies may have changed.

## Source Code Edit Workflow

1. Make source code changes
2. Ensure unit tests pass when run locally: `npm test -s`
3. Locally commit changes: `git commit` (or use the Visual Studio Code user interface)
4. Repeat steps 1-3 until ready to push changes
5. Add changelog entry (which could potentially cover several commits): `rush change`
6. Follow prompts to enter a change description or press ENTER if the change does not warrant a changelog entry. If multiple packages have changed, multiple sets of prompts will be presented. If the changes are only to non-published packages (like **testbed**), then `rush change` will indicate that a changelog entry is not needed.
7. Completing the `rush change` prompts will cause new changelog entry JSON files to be created.
8. Add/stage this new file or files using the "+" in VS Code or from the command line using `git add <name of file>` (can use `git status` to get name of file)
9. In order to keep the Git history clean, amend the prior commit using the **Commit Staged (Amend)** menu item in Visual Studio Code or use the command line: `git commit --amend --no-edit`
10. Push changes

If using the command line, steps 5 through 9 above can be completed in one step by running `rushchange.bat` from the imodeljs-core root directory.
> Note: The CI build will break if changes are pushed without running `rush change`. The fix will be to run `rush change` (as above) and push those changes as a separate commit.

Here is a sample [changelog](https://github.com/Microsoft/web-build-tools/blob/master/apps/rush/CHANGELOG.md) to demonstrate the level of detail expected.

## Updating dependencies/devDependencies on packages within the monorepo

The version numbers of internal dependencies should not be manually edited.
These will be automatically updated by the overall *version bump* workflow.
Note that the packages are published by CI builds only.

## Updating dependencies/devDependencies on packages external to monorepo

Use these instructions to update dependencies and devDependencies on external packages (ones that live outside of this monorepo).

1. Edit the appropriate `package.json` file to update the semantic version range
2. Run `rush check` to make sure that you are specifying consistent versions across the repository
3. Run `rush update` to make sure the newer version of the module specified in #1 is installed

## Other NPM Scripts

1. Build TypeDoc documentation for all packages: `rush docs`
2. Build TypeDoc documentation for a single package: `cd core\backend` and then `npm run docs`

## Build and run local documentation site

1. Install bemetalsmith-cli globally: `npm install -g @bentley/bemetalsmith-cli`
2. `buildDocSite core` or `buildDocSite ui`

The full list of npm scripts can be found in the root `package.json` file.
