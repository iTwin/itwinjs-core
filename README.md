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

## Current Build Instructions

1. Pull repository: `git pull`
2. Install dependencies: `npm install`
3. Build source: `gulp build`
4. Run tests: `gulp test`

## Current Build Output

* imodeljs-core/lib/
* published as imodeljs-core

## Future Build Instructions

1. Pull repository: `git pull`
2. Install dependencies: `npm install`
3. Build source: `npm run build`
4. Run tests: `npm run test`

## Future Build Output

| Output Directory                   | Published As      |
|------------------------------------|-------------------|
| imodeljs-core/source/frontend/lib/ | imodeljs-frontend |
| imodeljs-core/source/backend/lib/  | imodeljs-backend  |
| imodeljs-core/source/test/lib/     | Not published     |

Note that imodeljs-core/source/common/ is built into both the imodeljs-frontend and imodeljs-backend packages.
