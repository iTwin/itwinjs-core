## Developing a create-react-app with iModel.js template

### Setup

- [Install necessary prerequisites]($docs/getting-started/development-prerequisites)
- From a terminal, `npx create-react-app my-app-name --template @bentley/cra-template-imodeljs --scripts-version @bentley/react-scripts`
  - This will generate a new React application based on the iModel.js template in the `your-app-name` directory.
- Open the `your-app-name` directory in VS Code.
- Add a valid clientId, iModelId and projectId for your user in the .env file within the application's root directory.
  - This will be used for initial development. The idea is that it would be replaced by a proper model selection process in a production application.
- From a terminal at your application's root directory, `npm start`. This will serve the application with live reloading.
- Add/Update/Remove files as needed for your use case. If running `npm start` while making changes, your application should re-compile and reload.

### Build

- From a terminal at your application's root directory, `npm run build`. This will create a deployment-ready build in the "build" folder within the application's root directory. It is not necessary to build the application during development.

### Useful Links

- [Create React App](https://create-react-app.dev/)
- [Bentley React Scripts](https://www.npmjs.com/package/@bentley/react-scripts)
