# Installation Process

Because `imodeljs` applications are split into *backends* and *frontends*,
the below instructions are also split that way.

## Backend

The backend dependency is `presentation-backend`. It can simply be installed with
```bash
npm install presentation-backend
```

**Important:** the version of `imodeljs-backend` used by the application must
match its semver version range used by `presentation-backend`.

## Frontend

The primary frontend dependency is `presentation-frontend`. However,
consumers typically also want to depend on `presentation-components` which
contains various iModel.js Presentation-driven data providers and other components.
The packages can be installed with
```bash
npm install presentation-frontend presentation-components
```

**Important:** the version of `imodeljs-frontend` used by the application must
match its semver version range used by `presentation-frontend`.
