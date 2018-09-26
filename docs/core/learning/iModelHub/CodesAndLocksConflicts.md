# Codes and Locks conflicts
When sending update requests for [HubCode]($clients)s and [Lock]($clients)s (jointly refered to as resources) to iModelHub, it's possible that there could be conflicts due to other users requesting and using same resources.
## Conflict types
[IModelHubStatus.ConflictsAggregate]($bentley) can occur when any of the following errors occur and are [ignored](#ignoring-conflicts).

[IModelHubStatus.CodeReservedByAnotherBriefcase]($bentley) or [IModelHubStatus.LockOwnedByAnotherBriefcase]($bentley) can occur when another [Briefcase]($clients) owns these resources.

[IModelHubStatus.CodeDoesNotExist]($bentley) or [IModelHubStatus.LockDoesNotExist]($bentley) can occur when trying to send request with [ChangeState]($clients) modified for resources that do not exist.

[IModelHubStatus.PullIsRequired]($bentley) can occur when a Lock requires user to have a newer [ChangeSet]($clients) merged into their Briefcase file. It can also occur if user didn't set their current ChangeSet id in the request.

[IModelHubStatus.CodeStateInvalid]($bentley) can occur when a Code with [CodeState.Retired]($clients) is being updated to [CodeState.Reserved]($clients) or [CodeState.Used]($clients). It has to be updated to [CodeState.Available]($clients) first.

## Handling conflicts
### Large requests
When updating very large amounts of resources, requests are split into multiple smaller requests. Usually all resources are updated as a single transaction. However, when splitting into multiple requests, each request is considered a separate transaction. If one of these requests fails, earlier requests will not be reverted automatically, but further requests will not be sent.

It's possible to specify the amount of resources single request using [CodeUpdateOptions.codesPerRequest]($clients) or [LockUpdateOptions.locksPerRequest]($clients). However, that limit in general should not be increased, as it might cause individual requests to be too large and fail without reaching iModelHub. It could be useful to lower this limit when trying to get [detailed report](#detailed-reporting) of conflicting resources.

### Ignoring conflicts
Usually when a conflict occurs, all resources in that request will be reverted to their initial state. If the request should try to update as many of these resources as possible instead of trying to either update everything or nothing, these errors can be ignored on server. By setting [CodeUpdateOptions.continueOnConflict]($clients) or [LockUpdateOptions.continueOnConflict]($clients) to true, requests will continue updating resources when conflicts occur. An [IModelHubStatus.ConflictsAggregate]($bentley) will be returned from iModelHub instead of any of the other status values. If large amount of resources are updated, any subsequent requests after failure will still be sent and aggregate error will be returned when all requests finish.

### Detailed reporting
By default errors do not specify what resources caused the update to fail. [CodeUpdateOptions.deniedCodes]($clients) or [LockUpdateOptions.deniedLocks]($clients) can be set to true to return all of the failed resources. In case a lot of resources failed, error response will be truncated. It's possible to attempt ignoring these error response limits by specifying [CodeUpdateOptions.unlimitedReporting]($clients) or [LockUpdateOptions.unlimitedReporting]($clients), but that can cause failures trying to send the error response itself. Alternatively it's possible to [limit resources per request](#large-requests).
