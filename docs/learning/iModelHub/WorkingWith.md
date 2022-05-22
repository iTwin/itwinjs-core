# Working with iModelHub

## Working with iModelHub directly

iModels API is available in the following set of packages:

- `@itwin/imodels-access-frontend`
- `@itwin/imodels-access-backend`
- `@itwin/imodels-client-authoring`
- `@itwin/imodels-client-management`

These client libraries contain TypeScript classes and other types that can be used by both [frontends](../Glossary.md#frontend) and [backends](../Glossary.md#backend). Any method that requires access to the file system will have to be run in the backend.

iModelHub API covers basic calls to iModelHub that are part of larger workflows. For any calls that require working with actual iModel files, you should use [backend classes](#working-through-backend-classes).

## Before you start

- [Obtaining an AccessToken](../common/AccessToken.md)
- [Permissions](./Permissions)

## Working through backend classes

- [iModels](./iModels/index)
- [Briefcases](./Briefcases)
- [Codes and Locks](../backend/ConcurrencyControl.md)

## Working through clients package

- [Named Versions](./Versions)
- [Events](./Events)
