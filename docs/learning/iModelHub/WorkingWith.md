# Working with iModelHub

## Working with iModelHub directly

iModelHub API is available in the `@bentley/imodelhub-client` package.

Additional client APIs for various Bentley services can be found in the `clients/` directory alongside `imodelhub-client`

These client libraries contain TypeScript classes and other types that can be used by both [frontends]($docs/learning/Glossary.md#frontend) and [backends]($docs/learning/Glossary.md#backend). Any method that requires access to the file system will have to be run in the backend.

iModelHub API covers basic calls to iModelHub that are part of larger workflows. For any calls that require working with actual iModel files, you should use [backend classes](#working-through-backend-classes).

## Before you start

- [Obtaining an AccessToken]($docs/learning/common/AccessToken.md)
- [Creating iModelHub client](./Client)
- [Permissions](./Permissions)

## Working through backend classes

- [iModels](./iModels/index)
- [Briefcases](./Briefcases)
- [Codes and Locks]($docs/learning/backend/ConcurrencyControl.md)

## Working through clients package

- [Named Versions](./Versions)
- [Events](./Events)
