# Getting Started With iModel.js

## Required Tools

Writing an iModel.js application requires the following software:

- [Node.js](https://nodejs.org/) (latest 8.x LTS version)
  - This provides the backend JavaScript runtime.
  - The installation also includes the `npm` command line tool.
- [Google Chrome](https://www.google.com/chrome/)
  - This is the preferred tool for developing and debugging frontend JavaScript.
- [Git](https://git-scm.com/downloads)
  - This is the source code control system for the iModel.js repositories.

## Code Samples

The following samples showcase the iModel.js API in action:

- [Simple Viewer App](https://github.com/imodeljs/simple-viewer-app)
  - Embed an iModel.js viewport into your application to display graphical data.
  - Browse iModel catalog and view element properties.
- [iModel Query Agent](https://github.com/imodeljs/imodel-query-agent)
  - Listen to changes made to an iModel on the iModelHub.
  - Construct a 'Change Summary' of useful information.

## Developer Registration
**_Samples must be registered before they can be run._**
### Register a New Application
- [Agent Application](./agent-application.md) - Such as iModel Query Agent
- [Browser Application](./spa-application.md) - Such as Simple Viewer App

### Update an Existing Application
- [Update Existing Application](./update-application.md)

### Create Sample Project and iModel
- [Create New Sample Project](./sample-project.md)
- [Update Sample Project](./update-project.md)

## Suggested Tools

The following tools are very helpful and highly suggested for working with iModel.js:

- [Visual Studio Code](https://code.visualstudio.com/)
  - This is the recommended editor and debugger for iModel.js applications.
  - VS Code also supplies a graphical user interface for working with Git.
  - The following VS Code extensions can also be quite helpful:
    - [TSLint](https://marketplace.visualstudio.com/items?itemName=eg2.tslint) (use tslint.json from @bentley/build-tools to enforce Bentley coding standards)
    - [Debugger for Chrome](https://marketplace.visualstudio.com/items?itemName=msjsdiag.debugger-for-chrome)
    - [GitLens](https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens) (great tools for using Git inside VSCode)
    - [MarkdownLint](https://marketplace.visualstudio.com/items?itemName=DavidAnson.vscode-markdownlint) (for editing documentation)

## Recommended Reading

- [TypeScript](http://www.typescriptlang.org/)
  - iModel.js applications are written in TypeScript and then _compiled_ to plain JavaScript.
- [Node Package Manager (npm)](https://www.npmjs.com/)
  - `npm` is used to install and manage dependencies of an iModel.js application.
  - The `npm` [command line](https://docs.npmjs.com/cli/npm) and `npm` [scripts](https://docs.npmjs.com/misc/scripts) are used to build and test iModel.js applications.

## Support

Please see the [Community Resources](../learning/CommunityResources.md) page for the best places to get more help.
