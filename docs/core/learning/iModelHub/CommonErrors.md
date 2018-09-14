# Common errors thrown in majority of the iModel Hub calls:

[IModelHubError]($clients) with [IModelHubStatus.UserDoesNotHavePermission]($bentley) is thrown when the user does not have permission to perform that call. Users need at least Read permission to perform most of the calls. [IModelHubStatus.FailedToGetProjectPermissions]$(bentley) can be thrown when call to RBAC service has failed. See [Permissions](./Permissions.md) for more information.

[IModelHubError]($clients) with [IModelHubStatus.iModelDoesNotExists]($bentley) occurs when an [IModelRepository]($clients) with specified [Guid]($bentley) value does not exist on that project. That id might belong to an iModel for a different project, a deleted iModel, or it might not be associated with any iModel at all.

[IModelHubError]($clients) with [IModelHubStatus.iModelIsLocked]($bentley) or [IModelHubStatus.iModelIsNotInitialized]($bentley) can occur when sending requests to iModel that was created, but not initialized by iModel Hub. See [iModels](./iModels.md) for more information.

[IModelHubError]($clients) with [IModelHubStatus.OperationFailed]($bentley), [IModelHubStatus.DatabaseOperationFailed]($bentley) or [IModelHubStatus.DatabaseTemporarilyLocked]($bentley) can be thrown when an issue with a dependent service has occured within iModel Hub. In most of the cases these requests can be retried later.

[IModelRequestError]($clients) with [IModelHubStatus.UndefinedArgumentError]($bentley) or [IModelHubStatus.InvalidArgumentError]($bentley) if one of the required arguments is undefined or has an invalid value.

[WsgError]($clients) is thrown for errors that were returned from the Web Service itself and didn't reach iModel Hub.

[AuthenticationError]($clients) is thrown when request is redirected to a login page. This occurs when access token is invalid or expired.

[ResponseError]($clients) is thrown when error could not be parsed. This can occur when error happened on the client side or web service could not return a json response.
