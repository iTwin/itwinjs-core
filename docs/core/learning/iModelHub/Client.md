# iModelHub Client
To work with iModelHub API directly, you have to create an instance of [IModelHubClient]($clients). Once you have instance of the client, you can access various iModelHub class handlers through it. [IModelDb]($backend) covers most of the common functionality of iModelHub and it should be used instead of IModelHubClient when possible.

> You should try to reuse [IModelHubClient]($clients) instances, as performance sending multiple requests to iModelHub will be better on the same client instance. It's not necessary to reuse handler instances.

## iModelHub Client on backend
If you're working on a backend and require downloading and uploading files, you have to specify an implementation of [FileHandler]($clients). For iModelHub that should be [AzureFileHandler]($clients)

Example:
```ts
[[include:IModelHubClient.example-code]]
```
