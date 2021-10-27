# Common errors thrown in majority of the iModel Hub calls

[IModelHubError]($imodelhub-client) with [IModelHubStatus.UserDoesNotHavePermission]($bentley) is thrown when the user does not have permission to perform that call. Users need at least Read permission to perform most of the calls. [IModelHubStatus.FailedToGetProjectPermissions]$(bentley), [IModelHubStatus.FailedToGetAssetPermissions]$(bentley) can be thrown when call to RBAC service has failed. See [Permissions](./Permissions.md) for more information.

[IModelHubError]($imodelhub-client) with [IModelHubStatus.iModelDoesNotExist]($bentley) occurs when an [HubIModel]($imodelhub-client) with specified [Guid]($bentley) value does not exist on that project. That id might belong to an iModel for a different project, a deleted iModel, or it might not be associated with any iModel at all.

[IModelHubError]($imodelhub-client) with [IModelHubStatus.iModelIsLocked]($bentley) or [IModelHubStatus.iModelIsNotInitialized]($bentley) can occur when sending requests to iModel that was created, but not initialized by iModel Hub.

[IModelHubError]($imodelhub-client) with [IModelHubStatus.OperationFailed]($bentley), [IModelHubStatus.DatabaseOperationFailed]($bentley) or [IModelHubStatus.DatabaseTemporarilyLocked]($bentley) can be thrown when an issue with a dependent service has occurred within iModel Hub. In most of the cases these requests can be retried later.

[IModelHubClientError]($imodelhub-client) with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if one of the required arguments is undefined or has an invalid value.

[WsgError]($itwin-client) is thrown for errors that were returned from the Web Service itself and didn't reach iModel Hub.

[AuthenticationError]($itwin-client) is thrown when request is redirected to a login page. This occurs when access token is invalid or expired.

[ResponseError]($itwin-client) is thrown when error could not be parsed. This can occur when error happened on the client side or web service could not return a json response.
