# iModel creation

To start working with iModelHub, an iModel for an [iTwin](../../Glossary.md#itwin) has to be created. End users should usually create the iModel for an iTwin through iModelHub website. It's also possible to use [BackendIModelsAccess.createNewIModel](https://github.com/iTwin/imodels-clients/blob/52206238a863cb3ddad9e9abdec5700f8bf7ede6/itwin-platform-access/imodels-access-backend/src/BackendIModelsAccess.ts#L391) to create a new iModel in iModelHub.

## iModel initialization

Once an iModel is uploaded to iModelHub, it starts an initialization process, that prepares that iModel for use. Until the initialization successfully finishes, no requests can be made for that iModel.

iModel initialization is usually fast, especially for empty files. However, it is possible that iModel creation requests time out. If file is not initialized by the time create request times out, it could still get initialized in the future. [IModelState](https://github.com/iTwin/imodels-clients/blob/main/clients/imodels-client-management/src/base/interfaces/apiEntities/IModelInterfaces.ts#L8) specifies whether the file initialization is still in progress [IModelState.NotInitialized](https://github.com/iTwin/imodels-clients/blob/main/clients/imodels-client-management/src/base/interfaces/apiEntities/IModelInterfaces.ts#L13), or the initialization has completed [IModelState.Initialized](https://github.com/iTwin/imodels-clients/blob/main/clients/imodels-client-management/src/base/interfaces/apiEntities/IModelInterfaces.ts#L15).
