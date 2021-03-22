# Getting started (offline quick start)

## 1. Get the tools

Writing an iTwin.js application requires the following software:

- [Node.js](https://nodejs.org) (12.x LTS version)
  - This provides the backend JavaScript runtime.
  - The installation also includes the `npm` command line tool.

## 2. Get the code

The starter application is located in the [desktop-starter](https://github.com/imodeljs/desktop-starter) repo on GitHub. It is an example of an Electron based application and comes with a sample snapshot iModel.

> `git clone https://github.com/imodeljs/desktop-starter.git`

## 3. Build and run a sample app

> `npm install`

> `npm start`

The app will open a pre-packaged offline snapshot iModel. You will likely want to use your own snapshot iModel. Follow the [Create a snapshot iModel]($docs/learning/tutorials/create-test-imodel-offline) tutorial. Then open your snapshot by clicking the Home button and selecting "Open Offline Snapshot".

Desktop apps can also open cloud hosted iModels. If you do not have access to one, follow one of our tutorials to [create an online iModel]($docs/learning/tutorials/index.md). Then open your online iModel by selecting "Open Online iModel" and logging in.

&nbsp;
&nbsp;
---

## Next Steps

### [Create a snapshot iModel from your local data.]($docs/learning/tutorials/create-test-imodel-offline.md)

> Open your snapshot iModel in the desktop-starter app by clicking the home button in the upper left and clicking "Select snapshot".

### [Follow tutorials to dive deeper into iTwin.js]($docs/learning/tutorials/index.md)

### [iTwin.js Blog](https://medium.com/itwinjs)

<style>
  article#main h3:after {
    display: none;
  }
  blockquote {
    margin-top: 0px;
    margin-bottom: 0px;
  }
  blockquote > p {
    margin-bottom: 6px;
  }
</style>
