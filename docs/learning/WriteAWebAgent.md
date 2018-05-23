# Write A Web Agent

To write a [Web Agent](../overview/App.md#imodel-agents), you will do the following:

1. Write initialization logic, such as:
    * Start [IModelHost](./backend/IModelHost.md)
1. Access an iModel
    * Obtain an [AccessToken](./common/AccessToken.md)
    * [Open an iModel as a briefcase](./backend/IModelDb.md)
    * [Synchronize with iModelHub](./backend/IModelDbSync.md)
1. Register for iModelHub events
    * *TBD*
1. Write the operations of the agent, such as:
    * [Access Elements](./backend/AccessElements.md)
    * [Execute ECSQL queries](./backend/ExecutingECSQL.md)
1. [Package and deploy to the Web](./PackageAndDeployToTheWeb.md)