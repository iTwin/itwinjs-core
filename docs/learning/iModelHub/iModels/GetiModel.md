# Getting iModel

To work with iModelHub, you have to know your iModel's id. Most iModelHub requests will ask for an iModel id and you can specify it from by providing `HubIModel.wsgId` property. If you do not have an iModel for your ITwin yet, you first have to [create it](./CreateiModel.md).

If iModel is already created, its `HubIModel` instance can be retrieved by querying iModels:

```ts
[[include:IModelHandler.getIModels.example-code]]
```
