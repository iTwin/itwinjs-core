# iModel creation
To start working with iModelHub an iModel for a [Project]($clients) has to be created. End users should usually create the iModel for a Project through iModelHub website. It's possible to use [IModelDb.create]($backend) to create an empty iModel and upload it to iModelHub. It's also possible to upload an existing standalone iModel file through [IModelHandler.create]($clients).

## iModel initialization
Once iModel is uploaded to iModelHub, it starts a backend initialization process, which prepares that iModel for use. Until initialization successfully finishes, no requests can be made to that iModel.

iModel initialization is usually fast, especially for empty files. However, it is possible that iModel creation requests time out. If file is not initialized by the timeOutInMilliseconds specified in [IModelHandler.create]($clients), creation task will be rejected. It could still get initialized in the future. You can use [IModelHandler.getInitializationState]($clients) to check whether the file initialization is still in progress ([InitializationState.Scheduled]($clients)), or the initialization has completed (any other status).

When uploading an existing standalone iModel, different failure statuses represent most common issues with initialization. If initialization has failed with [InitializationState.Failed]($clients), it's possible, that deleting and creating new iModel with the same seed file could succeed, but it isn't guaranteed.
