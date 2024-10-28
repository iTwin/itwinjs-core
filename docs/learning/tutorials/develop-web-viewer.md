# Developing a Web Viewer

## Setup

- [Install necessary prerequisites](./development-prerequisites.md).
- From a terminal, `npx create-react-app your-app-name --template @itwin/web-viewer --scripts-version @bentley/react-scripts`
  - This will generate a new application based on the iTwin Viewer React component in the `your-app-name` directory.
- Open the `your-app-name` directory in VS Code.
- Follow these steps to obtain a new OIDC client to use in your viewer application:

  1. Go to <https://developer.bentley.com>
  2. Click the **Sign In** button and sign-in using your Bentley account credentials
     - If you have not already registered, click **Register now** and complete the registration process
  3. Navigate to the [My Apps](https://developer.bentley.com/my-apps/) page
  4. Click the **Register New** button
  5. Give your application a Name
  6. Select **SPA** (Single Page Web Application) as the Application Type
  7. Select the `itwin-platform` scope
  8. Set the **Redirect URL** to `http://localhost:3000/signin-callback`
  9. Set the **Post logout redirect URIs** to `http://localhost:3000`
  10. Click the **Save** button

- Once your new application is saved and a clientId is generated, add the clientId, list of scopes, and redirect url to the following variables in the .env file within the application's root directory: `IMJS_AUTH_CLIENT_CLIENT_ID`, `IMJS_AUTH_CLIENT_SCOPES`
  `IMJS_AUTH_CLIENT_REDIRECT_URI`.
- Add a valid contextId (i.e. Project Id) and iModelId for your user to the `IMJS_ITWIN_ID` and `IMJS_IMODEL_ID` variables in the .env file within the application's root directory.
  - You can obtain these ids from the "Show Ids" column of your "[My sample iModels](https://developer.bentley.com/my-imodels/)" page.
  - This will be used for initial development. The idea is that it would be replaced by a proper model selection process in a production application.
- From a terminal at your application's root directory, `npm start`. This will serve the application with live reloading.
- Add/Update/Remove files as needed for your use case. If running `npm start` while making changes, your application will recompile and reload.
- The viewer can be modified via the Viewer component in the App.tsx file. Visit the [iTwin Viewer React](https://www.npmjs.com/package/@itwin/web-viewer-react) documentation for more information.
- Visit the README file within the root directory of your application for additional development information.

## Build

- From a terminal at your application's root directory, `npm run build`. This will create a deployment-ready build in the "build" folder within the application's root directory. It is not necessary to build the application during development.

## Useful Links

- [iTwin Viewer React](https://www.npmjs.com/package/@itwin/web-viewer-react)
- [iTwin Viewer Create React App Template](https://www.npmjs.com/package/@itwin/cra-template-web-viewer)
- [Bentley React Scripts](https://www.npmjs.com/package/@bentley/react-scripts)
- [Create React App](https://create-react-app.dev/)

## Next Steps

- [iTwin Viewer - "Hello World"](./hello-world-viewer.md)
- [Visit the iTwin Sample Showcase](https://www.itwinjs.org/sample-showcase/)
