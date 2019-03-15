# Getting Started With iModel.js

## 1. Get the Tools

Writing an iModel.js application requires the following software:

- [Node.js](https://nodejs.org) (latest 10.x LTS version)
  - This provides the backend JavaScript runtime.
  - The installation also includes the `npm` command line tool.
- [Google Chrome](https://www.google.com/chrome/)
  - This is the preferred tool for developing and debugging frontend JavaScript.
- [Git](https://git-scm.com/downloads)
  - This is the source code control system for the iModel.js repositories.


### Suggested Tools
The following tools are very helpful and highly suggested for working with iModel.js:
- [Visual Studio Code](https://code.visualstudio.com/)
  - This is the recommended editor and debugger for iModel.js applications.
  - VS Code also supplies a graphical user interface for working with Git.
  - The following VS Code extensions can also be quite helpful:
    - [TSLint](https://marketplace.visualstudio.com/items?itemName=eg2.tslint) (use tslint.json from @bentley/build-tools to enforce Bentley coding standards)
    - [Debugger for Chrome](https://marketplace.visualstudio.com/items?itemName=msjsdiag.debugger-for-chrome)
    - [GitLens](https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens) (great tools for using Git inside VSCode)
    - [MarkdownLint](https://marketplace.visualstudio.com/items?itemName=DavidAnson.vscode-markdownlint) (for editing documentation)

## 2. Register Yourself

To be able to view/read [iModel](../learning/imodels) data, you will need access to the [iModelHub]($docs/learning/IModelHub/index.md), which requires a Bentley user account.

**[Register here](https://ims.bentley.com/IMS/Registration)**

_Note: Skip to step 3, if you already have a Bentley User Account._

## 3. Register your Application
Once you have a Bentley User account, you will need to register the application you are about to create so it can access iModelHub.

**[Register Here](./registration-dashboard.md)**

There are two types of apps you can register:

[Browser Application](../learning/app.md/#interactive-apps)<br/>
Our sample is called "Simple Viewer App" which can:
- Embed an iModel.js viewport into your application to display graphical data.
- Browse iModel catalog and view element properties.

[Agent Application](../learning/app.md/#agents-and-services)<br/>
Our sample is called "iModel Query Agent" which can:
- Listen to changes made to an iModel on the iModelHub.
- Construct a 'Change Summary' of useful information.

## 4. Create a Sample Project
Once you have a registered application, you will need content to work with. To get you started, Bentley can supply some example content using our “iModel Testdrive” organization. From the registration page you can create a new project and give access to other developers.

**[Register Here](./registration-dashboard?tab=1)**

_Note: The “iModel Testdrive” organization is intended for developer testing only.  See [this page](invalidlink) for information about administering a CONNECT project in your own organization._


## 5. Get the Sample Code
The Github repositories for the applications described in step 3.

[Simple Viewer App](https://github.com/imodeljs/simple-viewer-app)<br/>
[iModel Query Agent](https://github.com/imodeljs/imodel-query-agent)

<br/>
<br/>
<br/>

---
### Recommended Reading

- [TypeScript](http://www.typescriptlang.org/)
  - iModel.js applications are written in TypeScript and then _compiled_ to plain JavaScript.
- [Node Package Manager (npm)](https://www.npmjs.com/)
  - `npm` is used to install and manage dependencies of an iModel.js application.
  - The `npm` [command line](https://docs.npmjs.com/cli/npm) and `npm` [scripts](https://docs.npmjs.com/misc/scripts) are used to build and test iModel.js applications.

### Support

Please see the [Community Resources](../learning/CommunityResources.md) page for the best places to get more help.
