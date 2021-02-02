# Developing an agent application

## Setup

- [Install necessary prerequisites]($docs/getting-started/development-prerequisites)
- [Register an Agent Application](../../../getting-started/registration-dashboard/?tab=0&create=AGENT_APP)
  - Accept all defaults
  - Be sure to save the secret somewhere safe - it is only shown once
- [Clone agent-starter repo](https://github.com/imodeljs/agent-starter)
- If you do not have access to an iModel, follow one of our tutorials to [create an iModel]($docs/learning/tutorials/index.md)
- Add `{client_id}@apps.imsoidc.bentley.com` as a project participant of your test iModel using the [iModel Registration Dashboard](../../../getting-started/registration-dashboard/?tab=1)

> Allow some time after registering the agent application. The identity profile of the agent is being created in the background and can take between 5 and 10 minutes

## Build

- Open the cloned repo in VS Code
- Open integrated terminal
- `npm install`
- Create a `.env` file at the project root with the following:

    ``` ps
    ###############################################################################
    # This file contains secrets - don't commit or share it!
    ###############################################################################

    # Specify an iModel
    CONTEXT_ID=
    IMODEL_ID=

    # OIDC configuration
    # Don't forget to add <CLIENT_ID>@apps.imsoidc.bentley.com to your CONNECT project. This can be done in the iModel Registration Dashboard.
    CLIENT_ID=
    CLIENT_SECRET=
    ```

    > The values for `CONTEXT_ID` and `IMODEL_ID` can be obtained from the IDs column of the [iModel registration dashboard](../../../getting-started/registration-dashboard/?tab=1)
    > The values for `CLIENT_ID` and `CLIENT_SECRET` come from the Agent Application you registered during the Setup step

- `npm run build`

## Run

- `npm start`
- The agent will listen for changesets pushed to iModelHub
- Use the [iTwin Synchronizer](https://www.bentley.com/en/products/product-line/digital-twins/itwin-synchronizer) to synchronize a change and exercise the agent.
- For testing, it can often also be useful to skip the event listening and just run against a specific changeset. To do that, either run `npm start -- --latest` to use the latest changeset, or `npm start -- --changeset=<CHANGESETID>` to use any specific changeset

## Next Steps

- Read the [README](https://github.com/imodeljs/agent-starter/blob/master/README.md) for some more info
- Implement custom functionality in the agent to fit a business use case
- Watch our [Jump Start - Creating an Agent tutorial](https://www.youtube.com/watch?v=1E2srOoxc4I&t=46s) which explains in more detail how the agent-sample works
