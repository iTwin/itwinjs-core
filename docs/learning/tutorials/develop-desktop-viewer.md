# Developing a iTwin Desktop Viewer

## Setup

- [Install necessary prerequisites]($docs/learning/tutorials/development-prerequisites).
- From a terminal, `npx create-react-app your-app-name --template @itwin/desktop-viewer --scripts-version @bentley/react-scripts`
  - This will generate a new application based on the iTwin Viewer React component in the `your-app-name` directory.
- Open the `your-app-name` directory in VS Code
- Follow these steps to obtain a new OIDC client to use in your viewer application:
  1. Go to <https://developer.bentley.com>
  2. Click the **Sign In** button and sign-in using your Bentley account credentials
      - If you have not already registered, click **Register now** and complete the registration process.
  3. Click on your user icon and navigate to the **My Apps** page
  4. Click the **Register New** button
  5. Give your application a Name
  6. Select the **Visualization** API
  7. Select application type **Desktop**
  8. Enter **Redirect URL** `http://localhost:3000/signin-callback`
  9. Enter **Post logout Redirect URL**: `http://localhost:3000`.
  10. Click the **Save** button

## Build

- From a terminal at your application's root directory, `npm run build`. This will create a deployment-ready build in the "build" folder within the application's root directory. It is not necessary to build the application during development.

The app will open a pre-packaged offline snapshot iModel. You will likely want to use your own snapshot iModel. Follow the [Create a snapshot iModel]($docs/learning/tutorials/create-test-imodel-offline) tutorial. Then open your snapshot by clicking the Home button and selecting "Open Offline Snapshot". Alternatively, set the absolute path of your snapshot in `.env.local` prior to running `npm run start`.

Desktop apps can also open cloud hosted iModels. If you do not have access to one, follow one of our tutorials to [create an online iModel]($docs/learning/tutorials/index.md). Then open your online iModel by selecting "Open Online iModel" and logging in. Alternatively, the Context and iModel guids can be set in .env.local prior to running `npm run start`.

## Useful Links

- [Create React App](https://create-react-app.dev/)
- [iTwin Desktop Viewer React](https://www.npmjs.com/package/@itwin/desktop-viewer-react)
- [iTwin Desktop Viewer Create React App Template](https://www.npmjs.com/package/@itwin/cra-template-desktop-viewer)
- [Bentley React Scripts](https://www.npmjs.com/package/@bentley/react-scripts)

## Next Steps

- [iTwin Viewer - "Hello World"]($docs/learning/tutorials/hello-world-viewer/)
- [Visit the iTwin Sample Showcase](https://www.itwinjs.org/sample-showcase/)
