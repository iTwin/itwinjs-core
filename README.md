# Introduction

ECPresentation library helps retrieve presentation data from imodels and
takes care of unified selection.

# Getting Started

## Installation process

If your app is using separate packages for frontend and backend:
- In the frontend:
   ```bash
   npm install ecpresentation-frontend
   ```
- In the backend:
   ```bash
   npm install ecpresentation-backend
   ```
Else:
   ```bash
   npm install ecpresentation-backend ecpresentation-frontend
   ```

## Setting up

In addition to setting up *imodeljs-core* there are some steps that API users
must do before ECPresentation library can be used.

1. Register ECPresentation gateway in the frontend:
```typescript
import { IModelGateway } from "@bentley/imodeljs-frontend/lib/gateway/IModelGateway";
import ECPresentationGateway from "@bentley/ecpresentation-frontend/lib/gateway/ECPresentationGateway";
import { BentleyCloudGatewayConfiguration } from "@bentley/imodeljs-frontend/lib/gateway/BentleyCloudGatewayConfiguration";
BentleyCloudGatewayConfiguration.initialize(
  {info: {title: "my-app", version: "v1.0"}},
  [IModelGateway, ECPresentationGateway]
);
```

2. Register ECPresentation gateway in the backend:
```typescript
import { IModelGateway } from "@bentley/imodeljs-backend/lib/gateway/IModelGateway";
import ECPresentationGateway from "@bentley/ecpresentation-backend/lib/gateway/ECPresentationGateway";
import { BentleyCloudGatewayConfiguration } from "@bentley/imodeljs-backend/lib/gateway/BentleyCloudGatewayConfiguration";
BentleyCloudGatewayConfiguration.initialize(
  {info: {title: "my-app", version: "v1.0"}},
  [IModelGateway, ECPresentationGateway]
);
```

3. Ensure that ecpresentation is included:
```typescript
import ECPresentationManager from "@bentley/ecpresentation-backend/lib/ECPresentationManager";
ECPresentationManager;
```

## Software dependencies

The primary dependencies required by ecpresentation packages are the
imodeljs-core packages (backend and frontend) and the imodeljs-nodeaddonapi
package. It's **VERY IMPORTANT** that version of `imodeljs-nodeaddonapi`
used by `ecpresentation-backend` matches the one used by `imodeljs-backend`.

## API references

TODO: See sample app.

# Build and Test

The library uses [@microsoft/rush](https://github.com/Microsoft/web-build-tools/wiki/Rush)
for managing multiple packages in the repository. It's a requirement to
have this package installed globally:
```bash
npm install -g @microsoft/rush
```
After that the steps to build are simple:
```bash
rush install
rush rebuild
```
To build just one package + all its dependencies:
```bash
rush rebuild --to @bentley/ecpresentation-tests
```
To build rebuild all dependencies after changing one package:
```bash
rush rebuild --from @bentley/ecpresentation-frontend
```

## Test

In the repository root location:
```bash
npm run test
```

### Test dependencies

Tests have these primary dependencies:
- [mocha](https://mochajs.org/) test framework
- [chai](http://chaijs.com/) assertion library
- [typemoq](https://github.com/florinn/typemoq) mocking library. Chosen
mostly because it was written for typescript as opposed to most other
popular javascript libraries which have typescript declarations.

## Run Sample Application

In the repository root location:
```bash
npm start
```
