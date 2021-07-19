# iModel creation

To start working with iModelHub an iModel for a [Project]($context-registry-client) has to be created. End users should usually create the iModel for a Project through iModelHub website. It's also possible to use [BriefcaseManager.create]($backend) to create either an empty iModel or upload iModel from file.

## iModel initialization

Once iModel is uploaded to iModelHub, it starts a backend initialization process, which prepares that iModel for use. Until initialization successfully finishes, no requests can be made to that iModel.

iModel initialization is usually fast, especially for empty files. However, it is possible that iModel creation requests time out. If file is not initialized by the time create request times out, it could still get initialized in the future. [InitializationState]($imodelhub-client) specifies whether the file initialization is still in progress (InitializationState.Scheduled), or the initialization has completed (any other status).

When uploading an existing standalone iModel, different failure statuses represent most common issues with initialization. If initialization has failed with [InitializationState.Failed]($imodelhub-client), it's possible, that deleting and creating new iModel with the same seed file could succeed, but it isn't guaranteed.
