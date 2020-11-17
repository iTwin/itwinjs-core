## Developing an agent application

### Setup
- [Install necessary prerequisites]($docs/getting-started/development-prerequisites)
- [Register an Agent Application](../registration-dashboard?tab=0&create=AGENT_APP)
    - Accept all defaults
- [Clone imodeljs-samples repo](https://github.com/imodeljs/imodeljs-samples)
- Have access to a cloud hosted iModel. If you do not have access to one, follow one of our tutorials to [create an online iModel]($docs/learning/tutorials/index.md)
- Add {client_id}@apps.imsoidc.bentley.com as a project participant of your test iModel on the [iModel Registration Dashboard]($docs/getting-started/registration-dashboard)
 > Allow some time after registering the agent application. The identity profile of the agent is being created in the background and can take between 5 and 10 minutes.


### Build
- Open the cloned repo in VS Code
- Open integrated terminal
- `node ./common/scripts/install-run-rush install`
- Edit agent-app/query-agent/src/QueryAgentConfig.ts
    > `imjs_agent_imodel_name` = The name of your iModel<br/>
`imjs_agent_client_id` = client_id of the registered agent application<br/>
`imjs_agent_client_secret` = The client secret of registered agent application<br/>


- `node ./common/scripts/install-run-rush build -t imodel-query-agent`

### Run
- `cd agent-app\query-agent`
- `npm run start`
- The agent will listen for changesets for 40 seconds

In order to see changesets being logged, you can use the [imodel-changeset-test-utility](https://github.com/imodeljs/imodeljs-samples/tree/master/tools/imodel-changeset-test-utility).

In a second terminal (`Ctrl+Shift+5` in VS Code's integrated terminal)
- `cd tools\imodel-changeset-test-utility`
- Edit tools\imodel-changeset-test-utility\src\ChangesetGenerationConfig.ts
    > `imjs_agent_imodel_name` = The name of your iModel<br/>
`imjs_agent_client_id` = client_id of the registered agent application<br/>
`imjs_agent_client_secret` = cThe client secret of registered agent application<br/>

- `npm install`
- `npm run build`
- While the query-agent is running and listening for changesets...
- `npm run start`

You should see the query-agent receiving events and logging them to \agent-app\query-agent\lib\output\changeSummaries.
