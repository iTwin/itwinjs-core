# Permissions

Every iModelHub operation requires that user would be authorized to perform it. iModelHub uses Role Based Access Control (RBAC) service to manage authorization. RBAC allows to create roles with a chosen set of permissions. Every user can be assigned one of these roles. RBAC permissions are configured per [Project]($context-registry-client). You can access RBAC permissions management through this [portal](https://connect.bentley.com).

iModelHub uses 6 permissions:

- [Permissions](#permissions)
  - [Create iModel](#create-imodel)
  - [Delete iModel](#delete-imodel)
  - [Read iModel](#read-imodel)
  - [Modify iModel](#modify-imodel)
  - [Manage iModel Resources](#manage-imodel-resources)
  - [Manage iModel Versions](#manage-imodel-versions)

## Create iModel

Permissions automatically included: _Read iModel_, _Modify iModel_

Create iModel permission allows creating iModels. See [BriefcaseManager.create]($backend).

## Delete iModel

Permissions automatically included: _Read iModel_

Delete iModel permission allows deleting iModels. See [IModelHandler.delete]($imodelhub-client).

## Read iModel

Read iModel permission is required for every single iModelHub operation. It is automatically granted when giving any other iModelHub permission.

User that only has Read iModel permission can work with iModel, but they will be unable to make any changes to it. It means that users with this permission will be able to send all query requests. In addition to that, they will be able to acquire and download [Briefcase]($imodelhub-client)s and pull [ChangeSet]($imodelhub-client)s. See [BriefcaseDb.open]($backend) and [BriefcaseDb.pullAndMergeChanges]($backend).

## Modify iModel

Permissions automatically included: _Read iModel_

Modify iModel permission allows making changes to the iModel. It means that users will be able to manage their own [HubCode]($imodelhub-client)s and [Lock]($imodelhub-client)s and push their [ChangeSet]($imodelhub-client)s to iModelHub. See [concurrency control]($docs/learning/backend/concurrencycontrol) and [BriefcaseDb.pushChanges]($backend).

## Manage iModel Resources

Permissions automatically included: _Read iModel_, _Modify iModel_

Manage iModel Resources permission allows managing [HubCode]($imodelhub-client)s and [Lock]($imodelhub-client)s for the entire iModel. It means that they will be able to modify and relinquish Codes and Locks that belong to other users. Modifying resources that are owned by other users is not recommended, as it could cause conflicts.

## Manage iModel Versions

Permissions automatically included: _Read iModel_, _Modify iModel_

Manage iModel Versions permission allows creating and modifying Named [Version]($imodelhub-client)s. See [VersionHandler.create]($imodelhub-client).
