# Developing a Desktop Viewer

## Setup

- [Install necessary prerequisites]($docs/learning/tutorials/development-prerequisites).
- From a terminal, `npx create-react-app your-app-name --template @itwin/desktop-viewer --scripts-version @bentley/react-scripts`
  - This will generate a new application based on the iTwin Viewer React component in the `your-app-name` directory.
- Open the `your-app-name` directory in VS Code
- Follow these steps to obtain a new OIDC client to use in your viewer application:
  1. Go to <https://developer.bentley.com>
  2. Click the **Sign In** button and sign-in using your Bentley account credentials
      - If you have not already registered, click **Register now** and complete the registration process.
  3. Navigate to the [My Apps](https://developer.bentley.com/my-apps/) page
  4. Click the **Register New** button
  5. Give your application a Name
  6. Select the **Visualization** API
  7. Select application type **Desktop/Mobile**
  8. Enter **Redirect URI** `http://localhost:3000/signin-callback`
  9. Enter **Post logout Redirect URI**: `http://localhost:3000`.
  10. Click the **Save** button

Once your new application is saved a client ID is generated, add the client ID and redirect uri to the the following variables in the `.env` file within the application's root directory: `ITWIN_VIEWER_CLIENT_ID` and `ITWIN_VIEWER_REDIRECT_URI`.

- From a terminal at your application's root directory, `npm start`. This will serve the application with live reloading.

> Note: The live reloading is for the frontend only. The backend would need to be re-built on each change using `npm run build:backend`.

## Build

From a terminal at your application's root directory, `npm run build`. This will create both the frontend in the "build" folder and backend in the "lib" folder within the application's root directory. It is not necessary to build the frontend during development.

The app will open a pre-packaged offline snapshot iModel. You will likely want to use your own snapshot iModel. Follow the [Create a snapshot iModel]($docs/learning/tutorials/create-test-imodel-offline) tutorial. Then open your snapshot by clicking the Home button and selecting "Open Offline Snapshot". Alternatively, set the absolute path of your snapshot in `.env.local` using `ITWIN_VIEWER_SNAPSHOT` variable prior to running `npm run start`.

Desktop apps can also open cloud hosted iModels. If you do not have access to one, follow one of our tutorials to [create an online iModel]($docs/learning/tutorials/index.md). Then open your online iModel by selecting "Open Online iModel" and logging in.

## Useful Links

- [iTwin Desktop Viewer React](https://www.npmjs.com/package/@itwin/desktop-viewer-react)
- [iTwin Desktop Viewer Create React App Template](https://www.npmjs.com/package/@itwin/cra-template-desktop-viewer)
- [Bentley React Scripts](https://www.npmjs.com/package/@bentley/react-scripts)
- [Create React App](https://create-react-app.dev/)

## Next Steps

- [iTwin Viewer - "Hello World"]($docs/learning/tutorials/hello-world-viewer/)
- [Visit the iTwin Sample Showcase](https://www.itwinjs.org/sample-showcase/)
