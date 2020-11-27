## Developing a create-react-app with iModeljs template

### Setup

- [Install necessary prerequisites]($docs/getting-started/development-prerequisites)
- Have access to a cloud hosted iModel. If you do not have access to one, follow one of our tutorials to [create an online iModel]($docs/learning/tutorials/index.md)
- To use this template, add `--template @bentley/cra-template-imodeljs` when creating a new app. You should also use the @bentley/react-scripts scripts version to compile your application.

For example for creating a React app with iModeljs template, use the following command from command prompt.

- `npx create-react-app my-app-name --template @bentley/cra-template-imodeljs --scripts-version @bentley/react-scripts`

### Environment Variables

Prior to running the app, add a valid clientId, iModelId and projectId for your user in the .env file:

```
# ---- Test ids ----
imjs_browser_test_client_id = ""
imjs_test_imodel = ""
imjs_test_project = ""

### Run

- `npm start`

```
