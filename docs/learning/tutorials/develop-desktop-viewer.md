# Developing a Desktop Viewer

The application is built using [Vite](https://github.com/vitejs/vite), and scaffolded using [degit](https://github.com/Rich-Harris/degit).

## Setup

- [Install necessary prerequisites](./development-prerequisites.md).
- From a terminal, `npx degit iTwin/viewer/packages/templates/desktop#master your-app-name`
  - This will generate a new application based on the iTwin Viewer React component in the `your-app-name` directory.
- Open the `your-app-name` directory in VS Code and run `npm install` (or `pnpm install`). This will install all the dependencies listed in your package.json.
- Follow these steps to obtain a new OIDC client to use in your viewer application:
  1. Go to <https://developer.bentley.com>
  2. Click the **Sign In** button and sign-in using your Bentley account credentials
     - If you have not already registered, click **Register now** and complete the registration process
  3. Navigate to the [My Apps](https://developer.bentley.com/my-apps/) page
  4. Click the **Register New** button
  5. Give your application a Name
  6. Select **Native** as the Application Type
  7. Select the `itwin-platform` scope
  8. Set the **Redirect URL** to `http://localhost:3001/signin-callback`
  9. Set the **Post logout redirect URIs** to `http://localhost:3001`
  10. Click the **Save** button

Once your new application is saved and a client ID is generated, add the client ID and redirect uri to the following variables in the `.env` file within the application's root directory: `ITWIN_VIEWER_CLIENT_ID` and `ITWIN_VIEWER_REDIRECT_URI`.

- From a terminal at your application's root directory, `npm start`. This will serve the application with live reloading.

> Note: The live reloading is for the frontend only. The backend would need to be re-built on each change using `npm run build:backend`.

## Build

From a terminal at your application's root directory, run `npm run build`. This will create both the frontend in the "dist" folder and backend in the "lib" folder within the application's root directory. You may run `npm run preview` to start the Electron app and serve the frontend from a local static server. It is not necessary to build the frontend during development.

The app will open a pre-packaged offline snapshot iModel.

Desktop apps can also open cloud hosted iModels. If you do not have access to one, follow one of our tutorials to [create an online iModel](./index.md). Then open your online iModel by selecting "Open Online iModel" and logging in.

## Useful Links

- [iTwin Desktop Viewer React](https://www.npmjs.com/package/@itwin/desktop-viewer-react)
- [iTwin Desktop Viewer Vite Template](https://github.com/iTwin/viewer/tree/master/packages/templates/desktop)
- [Vite](https://vite.dev/guide/)

## Next Steps

- [iTwin Viewer - "Hello World"](./hello-world-viewer)
- [Visit the iTwin Sample Showcase](https://www.itwinjs.org/sample-showcase/)
