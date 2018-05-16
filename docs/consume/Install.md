# Installation Process

Because `imodeljs` applications are split into *backends* and *frontends*,
the below instructions are also split that way.

## Backend

The backend dependency is `ecpresentation-backend`. It can simply be install with
```bash
npm install ecpresentation-backend
```

**Important:** the version of `imodeljs-backend` used by the application must
match its semver version range used by `ecpresentation-backend`.

## Frontend

The primary frontend dependency is `ecpresentation-frontend`. However,
consumers typically also want to depend on `ecpresentation-controls` which
contains various ECPresentation-driven data providers. The packages can be
installed with
```bash
npm install ecpresentation-frontend ecpresentation-controls
```

**Important:** the version of `imodeljs-frontend` used by the application must
match its semver version range used by `ecpresentation-frontend`.