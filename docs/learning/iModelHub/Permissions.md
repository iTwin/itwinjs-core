# Permissions

Every iModelHub operation requires that user would be authorized to perform it. iModelHub uses Role Based Access Control (RBAC) service to manage authorization. RBAC allows to create roles with a chosen set of permissions. Every user can be assigned one of these roles. RBAC permissions are configured per [Project]($context-registry-client). You can access RBAC permissions management through this [portal](https://connect.bentley.com).

iModelHub uses 6 permissions:

- [Permissions](#permissions)
  - [Create iModel](#create-imodel)
  - [Delete iModel](#delete-imodel)
  - [Read iModel](#read-imodel)
  - [Modify iModel](#modify-imodel)
  - [Manage iModel Versions](#manage-imodel-versions)

## Create iModel

Permissions automatically included: _Read iModel_, _Modify iModel_

Create iModel permission allows creating iModels. See [BackendHubAccess.createNewIModel]($backend).

## Delete iModel

Permissions automatically included: _Read iModel_

Delete iModel permission allows deleting iModels. See [BackendHubAccess.deleteIModel]($backend).

## Read iModel

Read iModel permission is required for every iModelHub operation. It is automatically granted when giving any other iModelHub permission.

User that only has Read iModel permission can work with iModel, but they will be unable to make any changes to it. It means that users with this permission will be able to send all query requests. In addition to that, they will be able to acquire and download a `Briefcase` and pull `Changesets`. See [BriefcaseDb.open]($backend) and [BriefcaseDb.pullChanges]($backend).

## Modify iModel

Permissions automatically included: _Read iModel_

Modify iModel permission allows making changes to the iModel. It means that users will be able to manage `Locks` and push `Changesets`s to iModelHub. See [concurrency control]($docs/learning/backend/concurrencycontrol) and [BriefcaseDb.pushChanges]($backend).

## Manage iModel Versions

Permissions automatically included: _Read iModel_, _Modify iModel_

Manage iModel Versions permission allows creating and modifying Named [Version]($imodelhub-client)s. See [VersionHandler.create]($imodelhub-client).
