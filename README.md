# imodeljs-core

iModelJs extends the iModel technology stack to provide a JavaScript library (built using TypeScript) for querying, displaying, and modifying iModels.
It can be used to build:

* Backend agents and other web services
* Web applications with browser frontends
* (Future) Desktop applications that use web UI frameworks
* (Future) Mobile applications that use web UI frameworks

imodeljs-core is the name of the overall git repository.
The source code is organized according to where it can run:

| Directory        | Design Requirements |
|------------------|---------------------|
| source/backend/  | Designed for backend requirements. Runs in a standalone JavaScript engine (Node in this case). May have file system and Node dependencies  |
| source/frontend/ | Designed for frontend requirements. Must be able to run in a web browser. Cannot have file system or Node dependencies. |
| source/common/   | Design to run either in frontend or backend. Must adhere to frontend restrictions. |
| source/gateway/  | Configures how the frontend talks to the backend. This source code is used by both the frontend and backend. |
| source/test/     | Specific for unit tests. The test framework puts the frontend and backend together in a single executable. |

## Prerequisites

* **Node**: an installation of the latest security patch of Node 8.9.x downloaded from [nodejs.org](https://nodejs.org/en/). The Node installation also includes the **npm** package manager.
* **Visual Studio Code**: an optional dependency, but the repository structure is optimized for use with [Code](https://code.visualstudio.com/).

## Build Instructions

1. Pull repository: `git pull`
2. Install dependencies: `npm install`
3. Clean output: `npm run clean`
4. Build source: `npm run build`
5. Run tests: `npm run test`

Note that all build instructions are designed to run from the imodeljs-core root directory.
The individual commands orchestrate separate backend, frontend, and test steps as required.

## Migrating to New Build Instructions

| Build step           | New Command   | Old Command |
|----------------------|---------------|-------------|
| Install dependencies | npm install   | npm install |
| Clean output         | npm run clean | gulp clean  |
| Build source         | npm run build | gulp build  |
| Run tests            | npm run test  | gulp test   |

## Other NPM Scripts

1. Build TypeDoc documentation: `npm run docs`
2. Extract sample code from test directory (run automatically as a *pre* step by the TypeDoc build command above): `npm run extract`
3. Run lint rules against entire source tree: `npm run lint`

The full list of npm scripts can be found in the root `package.json` file.

## Managing the packages in the imodeljs-core repository

The imodeljs-core repository has characteristics of a *monorepo*.
That is, multiple npm packages are managed within a single git repository.
The list below describes each of the packages:

* `package.json`
  * Private, not published
  * Provides the npm scripts to work with this repository
  * Identifies the overall devDependencies (union of backend, frontend, and test devDependencies). Many devDependencies are in common between backend and frontend, so consolidating them makes them easier to manage.
* `source/backend/package.json`
  * Controls the version number for **@bentley/imodeljs-backend**
  * Controls the backend package dependencies (but not devDependencies)
* `source/frontend/package.json`
  * Controls the version number for and dependencies of **@bentley/imodeljs-frontend**
  * Controls the frontend package dependencies (but not devDependencies)
* `source/test/package.json`
  * Private, not published
  * Controls the test dependencies (but not devDependencies)

### Installing dependencies and devDependencies

The single `npm install` command run at the root of the repository installs devDependencies at the root and iterates into backend, frontend, and test to install dependencies.
This is accomplished by taking advantage of a *postinstall* hook.
After a successful install, you will notice multiple **node_modules** directories:

| node_modules Directory        | Contents                |
|-------------------------------|-------------------------|
| node_modules/                 | Overall devDependencies |
| source/backend/node_modules/  | Backend dependencies    |
| source/frontend/node_modules/ | Frontend dependencies   |
| source/test/node_modules/     | Test dependencies       |

Note that there will also be a `package.json` and `package-lock.json` that corresponds with each node_modules directory.

### Updating devDependencies

To update devDependencies run `npm update` in the root directory of the repository.
This does not iterate into the backend, frontend, and test subdirectories.

### Updating dependencies

To update dependencies (for example, moving up to a new version of **@bentley/geometry-core** or **@bentley/bentleyjs-core**), run `npm run update:dependencies` in the root directory of the repository.
This iterates into the backend, frontend, and test subdirectories and runs `npm update` in each one.
Unfortunately, `npm update` does not have a *postupdate* hook, so a separate command had to be introduced.

## Build Output and Publishing

| Output Directory     | Published As      |
|----------------------|-------------------|
| source/backend/lib/  | imodeljs-backend  |
| source/frontend/lib/ | imodeljs-frontend |
| source/test/lib/     | Not published     |

Note that imodeljs-core/source/common/ is built into both the **imodeljs-backend** and **imodeljs-frontend** packages.

### Publishing

Publishing is now a 2 step process as there are 2 separate packages.
Generally, imodeljs-backend and imodeljs-frontend are published at the same time, but there could be cases of backend-specific or frontend-specific fixes.
Note that any change to a "common" file is a change to both the **imodeljs-backend** and **imodeljs-frontend**.

### Publish imodeljs-backend

These instructions assume that you have already updated the version number in `source/backend/package.json` and have successfully rebuilt.

1. Change to the backend directory: `cd source/backend`
2. Publish: `npm publish`

### Publish imodeljs-frontend

These instructions assume that you have already updated the version number in `source/frontend/package.json` and have successfully rebuilt.

1. Change to the frontend directory: `cd source/frontend`
2. Publish: `npm publish`
