# Getting iModel
To work with iModelHub, you have to know your iModel's id. Most of the iModelHub requests will ask for an iModel id and you can specify it from by providing [HubIModel.wsgId]($imodelhub-client) property. If you do not have an iModel for your CONNECT [Project]($context-registry-client) yet, you first have to [create it](./CreateiModel.md).

If iModel is already created, its [HubIModel]($imodelhub-client) instance can be retrieved by querying iModels:
```ts
[[include:IModelHandler.getIModels.example-code]]
```
