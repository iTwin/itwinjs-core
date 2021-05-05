# Developing a web viewer

## Develop

- [Install necessary prerequisites]($docs/getting-started/development-prerequisites).
- From a terminal, `npx create-react-app your-app-name --template @bentley/itwin-viewer --scripts-version @bentley/react-scripts`
  - This will generate a new application based on the iTwin Viewer React component in the `your-app-name` directory.
- Open the `your-app-name` directory in VS Code.
- Add a valid contextId (i.e. Project Id) and iModelId for your user to the IMJS_CONTEXT_ID and IMJS_IMODEL_ID variables in the .env file within the application's root directory.
  - You can obtain these ids from the "Show Ids" column of your [registration dashboard](https://www.itwinjs.org/getting-started/registration-dashboard?tab=1)
  - This will be used for initial development. The idea is that it would be replaced by a proper model selection process in a production application.
- From a terminal at your application's root directory, `npm start`. This will serve the application with live reloading.
- Add/Update/Remove files as needed for your use case. If running `npm start` while making changes, your application will recompile and reload.
- The viewer can be modified via the Viewer component in the App.tsx file. Visit the [iTwin Viewer React](https://www.npmjs.com/package/@bentley/itwin-viewer-react) documentation for more information.
- Visit the README file within the root directory of your application for additional development information.

## Build

- From a terminal at your application's root directory, `npm run build`. This will create a deployment-ready build in the "build" folder within the application's root directory. It is not necessary to build the application during development.

## Useful Links

- [Create React App](https://create-react-app.dev/)
- [iTwin Viewer React](https://www.npmjs.com/package/@bentley/itwin-viewer-react)
- [iTwin Viewer Create React App Template](https://www.npmjs.com/package/@bentley/cra-template-itwin-viewer)
- [Bentley React Scripts](https://www.npmjs.com/package/@bentley/react-scripts)

## Next Steps

- [iTwin Viewer - "Hello World"]($docs/learning/tutorials/hello-world-viewer/)
- [Visit the iTwin Sample Showcase](https://www.itwinjs.org/sample-showcase/)
