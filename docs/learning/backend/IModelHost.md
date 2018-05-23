# IModelHost

A [backend](../Glossary.md#backend) must call [IModelHost.startup]($backend) before using any of the classes in imodeljs-backend. IModelHost initializes imodeljs-backend and captures backend configuration.

A backend may need to set [IModelHostConfiguration.briefcaseCacheDir]($backend) based on deployment parameters

A backend may need to set [IModelHostConfiguration.appAssetsDir]($backend) to identify its own assets directory.

*Example:*
 ``` ts
 [[include:IModelHost.startup]]
 ```
