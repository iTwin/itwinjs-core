# Introduction

iModelJs Presentation library helps retrieve presentation data from iModels and
takes care of unified selection.

# Getting Started

## About this Repository

This repository is a *monorepo* that holds the source code to several npm
packages. It is built using [Rush](http://rushjs.io/).

See [rush.json](./rush.json) for the list of packages. These packages are
described below:
- `package.json`
  - Private, not published
  - Provides the npm scripts to work with this repository
  - Identifies the overall devDependencies (union of backend, frontend, and test
  devDependencies). Many devDependencies are in common between backend and
  frontend, so consolidating them makes them easier to manage.
- `packages/common/package.json`
  - Controls the version number for **@bentley/presentation-common**
  - Controls the package dependencies for the source code in common to both the
  backend and frontend
- `packages/backend/package.json`
  - Controls the version number and package dependencies for **@bentley/presentation-backend**
- `packages/frontend/package.json`
  - Controls the version number and package dependencies for **@bentley/presentation-frontend**
- `packages/components/package.json`
  - Controls the version number and package dependencies for **@bentley/presentation-components**
- `packages/sample/package.json`
  - Private, not published
  - Sample application used for testing the library using read-world
  controls.
- `packages/integration-tests/package.json`
  - Private, not published
  - Integration tests' package which uses the library just like a
  real-world app would.

## Consuming

See [this page](./docs/consume/index.md) on how to consume the library.

## Contributing

See [this page](./docs/contribute/index.md) on how to contribute to the library.
