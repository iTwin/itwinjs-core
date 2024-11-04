﻿<p align="center">
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

Each package has its own **node_modules** directory that contains symbolic links to *common* dependencies managed by Rush.

## Prerequisites

- [Git](https://git-scm.com/)
- [Node](https://nodejs.org/en/): an installation of the latest security patch of Node 20. The Node installation also includes the **npm** package manager.
- [pnpm](https://pnpm.io/): our required package manager. It is more performant and monorepo friendly than `npm`. We recommend installing `pnpm` using [`corepack enable pnpm`](https://pnpm.io/installation#using-corepack). Note you may have to use an administrator shell to run the command.
- [Rush](https://github.com/Microsoft/web-build-tools/wiki/Rush): to install `npm install -g @microsoft/rush`
- [TypeScript](https://www.typescriptlang.org/): this is listed as a devDependency, so if you're building it from source, you will get it with `rush install`.
- [Visual Studio Code](https://code.visualstudio.com/): an optional dependency, but the repository structure is optimized for its use

> See [supported platforms](./docs/learning/SupportedPlatforms.md) for further information.

## Build Instructions

1. Clone repository (first time) with `git clone` or pull updates to the repository (subsequent times) with `git pull`
2. Install dependencies: `rush install`
3. Clean: `rush clean`
4. Build source: `rush build`
5. Run tests: `rush cover`

The `-v` option for `rush` is short for `--verbose` which results in a more verbose command.

The above commands iterate and perform their action against each package in the monorepo.

If you get an error similar to the following, it means that the repo has stopped making use of an npm package that was used in the past.

```
[Error: ENOENT: no such file or directory, stat '/.../itwinjs-core/test-apps/display-test-app/node_modules/@bentley/react-scripts']
```

To fix this build error, you should completely remove the node_modules directory that is referenced in the error with `rush purge`, and then rerun `rush install`.

For incremental builds, the `rush build` command can be used to only build packages that have changes versus `rush rebuild` which always rebuilds all packages.

> Note: It is a good idea to `rush install` after each `git pull` as dependencies may have changed.

## Source Code Edit Workflow

1. Make source code changes on a new Git branch
2. Ensure unit tests pass when run locally: `rush cover`
3. Ensure linting passes when run locally: `rush lint`
4. Locally commit changes: `git commit` (or use the Visual Studio Code user interface)
5. Repeat steps 1-4 until ready to push changes
6. Check for API signature changes: `rush extract-api`. This will update the signature files, located in `common/api`. **Note:** before doing this, first do the following:
    - Be sure that your branch is up to date with the target branch (i.e. `git merge origin/master`)
    - Cleanup your build output: `rush clean`
    - Rebuild the project: `rush build`
7. Review any diffs to the API signature files in the `common/api` directory to ensure they are compatible with the intended release of the package.
    - If any differences are in packages not modified on this branch, revert the changes before committing.
8. Add changelog entry (which could potentially cover several commits): `rush change`
9. Follow prompts to enter a change description or press ENTER if the change does not warrant a changelog entry. If multiple packages have changed, multiple sets of prompts will be presented. If the changes are only to non-published packages (like **display-test-app**), then `rush change` will indicate that a changelog entry is not needed.
10. Completing the `rush change` prompts will cause new changelog entry JSON files to be created.
11. Add and commit the changelog JSON files and any API signature updates.
12. Publish changes on the branch and open a pull request.

> If executing scripts from `package.json` files in any of the subdirectories, we recommend using [`rushx`](https://rushjs.io/pages/commands/rushx/) over `npm`.

If using the command line, steps 8 through 11 above can be completed in one step by running `rushchange.bat` from the imodeljs root directory.
Only use `rushchange.bat` if none of the changes require a changelog entry.
> Note: The CI build will break if changes are pushed without running `rush change` and `rush extract-api` (if the API was changed). The fix will be to complete steps 6 through 11.

Here is a sample [changelog](https://github.com/microsoft/rushstack/blob/master/apps/rush/CHANGELOG.md) to demonstrate the level of detail expected.

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
2. Build TypeDoc documentation for a single package: `cd core\backend` and then `rushx docs`

## Contribution

If you have questions, or wish to contribute to iTwin.js, see our [Contributing guide](./CONTRIBUTING.md).

## Licensing

Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](./LICENSE.md) for license terms and full copyright notice.
