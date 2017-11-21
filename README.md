# imodeljs-core

iModelJs extends the iModel technology stack to provide a JavaScript library (built using TypeScript) for querying, displaying, and modifying iModels.
It can be used to build:

* Backend agents and other web services
* Web applications with browser frontends

imodeljs-core is the name of the overall git repository.
The source code is organized according to where it can run:

| Directory        | Design Requirements |
|------------------|---------------------|
| source/frontend/ | Designed for frontend requirements. Must be able to run in a web browser. Cannot have file system or Node dependencies. |
| source/backend/  | Designed for backend requirements. Runs is a standalone JavaScript engine. May have file system and Node dependencies  |
| source/common/   | Design to run either in frontend or backend. Must adhere to frontend restrictions. |
| source/test/     | Specific for unit tests. The test framework puts the frontend and backend together in a single executable. |

## Prerequisites

* **Node**: an installation of the latest security patch of Node 8.9.x downloaded from [nodejs.org](https://nodejs.org/en/).

## Build Instructions

1. Pull repository: `git pull`
2. Install dependencies: `npm install`
3. Clean output: `npm run clean`
4. Build source: `npm run build`
5. Run tests: `npm run test`

Note that all build instructions are designed to run from the imodeljs-core root directory.
The individual commands orchestrate separate frontend, backend, and test steps as required.

## Migrating to New Build Instructions

| Build step           | New Command   | Old Command |
|----------------------|---------------|-------------|
| Install dependencies | npm install   | npm install |
| Clean output         | npm run clean | gulp clean  |
| Build source         | npm run build | gulp build  |
| Run tests            | npm run test  | gulp test   |

## Build Output and Publishing

| Output Directory                   | Published As      |
|------------------------------------|-------------------|
| imodeljs-core/source/common/lib/   | imodeljs-common   |
| imodeljs-core/source/frontend/lib/ | imodeljs-frontend |
| imodeljs-core/source/backend/lib/  | imodeljs-backend  |
| imodeljs-core/source/test/lib/     | Not published     |

### Publishing

Publishing is now a 3 step process as there are 3 separate packages.
Generally, imodeljs-common, imodeljs-frontend, and imodeljs-backend are published at the same time, but there could be cases of common-specific, frontend-specific, or backend-specific fixes.

### Publish Steps

1. Change to the common directory: `cd source/common`
2. Publish: `npm publish`
1. Change to the backend directory: `cd source/backend`
2. Publish: `npm publish`
1. Change to the frontend directory: `cd source/frontend`
2. Publish: `npm publish`

## Other NPM Scripts

1. Build TypeDoc documentation for frontend/backend/common: `npm run docs`
2. Extract sample code from test directory (run automatically as a *pre* step by the TypeDoc build command above): `npm run extract`
3. Run lint rules against entire source tree: `npm run lint`

The full list of npm scripts can be found in the root package.json file.