# iModel creation

To start working with iModelHub, an iModel for an [iTwin](../../Glossary.md#itwin) has to be created. End users should usually create the iModel for an iTwin through iModelHub website. It's also possible to use the [BackendHubAccess.createNewIModel]($backend) method on [IModelHost.hubAccess]($backend) to create a new iModel in iModelHub.

## iModel initialization

Once an iModel is uploaded to iModelHub, it starts an initialization process, that prepares that iModel for use. Until the initialization successfully finishes, no requests can be made for that iModel.

iModel initialization is usually fast, especially for empty files. However, it is possible that iModel creation requests time out. If file is not initialized by the time create request times out, it could still get initialized in the future. [IModelState](https://github.com/iTwin/imodels-clients/blob/main/clients/imodels-client-management/src/base/interfaces/apiEntities/IModelInterfaces.ts#L8) specifies whether the file initialization is still in progress [IModelState.NotInitialized](https://github.com/iTwin/imodels-clients/blob/main/clients/imodels-client-management/src/base/interfaces/apiEntities/IModelInterfaces.ts#L13), or the initialization has completed [IModelState.Initialized](https://github.com/iTwin/imodels-clients/blob/main/clients/imodels-client-management/src/base/interfaces/apiEntities/IModelInterfaces.ts#L15).
