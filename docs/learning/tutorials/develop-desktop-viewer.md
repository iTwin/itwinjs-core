# Developing a desktop viewer

## Setup

- [Install necessary prerequisites]($docs/getting-started/development-prerequisites)
- [Clone desktop-starter repo](https://github.com/imodeljs/desktop-starter)

## Create client

- Navigate to [developer.bentley.com](https://developer.bentley.com/register/)
- Sign in
- Configure client
  - Provide client name
  - API associations: "Visualization"
  - Application type: "Desktop/Mobile"
  - Redirect URI: "http://localhost:3000/signin-callback"
  - Post logout redirect URI: "http://localhost:3000"
  - Save
- View Details
- Copy Client ID

## Build

- Open the cloned repo in VS Code
- Edit [./src/backend/main.ts](https://github.com/imodeljs/desktop-starter/blob/master/src/backend/main.ts#L55)
- Replace `process.env.ELECTRON_CLIENT_ID` with your Client ID
  - *Or set environment variable `ELECTRON_CLIENT_ID` to your Client ID in your shell*
- `npm install`
- `npm run build`

## Run

- `npm run start`

The app will open a pre-packaged offline snapshot iModel. You will likely want to use your own snapshot iModel. Follow the [Create a snapshot iModel]($docs/learning/tutorials/create-test-imodel-offline) tutorial. Then open your snapshot by clicking the Home button and selecting "Open Offline Snapshot". Alternatively, set the absolute path of your snapshot in .env.local prior to running `npm run start`.

Desktop apps can also open cloud hosted iModels. If you do not have access to one, follow one of our tutorials to [create an online iModel]($docs/learning/tutorials/index.md). Then open your online iModel by selecting "Open Online iModel" and logging in. Alternatively, the Context and iModel guids can be set in .env.local prior to running `npm run start`.
