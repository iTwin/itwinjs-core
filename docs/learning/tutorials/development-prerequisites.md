# Development prerequisites

Writing an iTwin.js application requires the following software:

- [Node.js](https://nodejs.org) (latest 10.x or 12.x LTS version)
  - This provides the backend JavaScript runtime.
  - The installation also includes the `npm` command line tool.
- [Google Chrome](https://www.google.com/chrome/)
  - This is the preferred tool for developing and debugging frontend JavaScript.
- [Git](https://git-scm.com/downloads)
  - This is the source code control system for the iTwin.js repositories.

## Suggested tools

The following tools are very helpful and highly suggested for working with iTwin.js:

- [Visual Studio Code](https://code.visualstudio.com/)
  - This is the recommended editor and debugger for iTwin.js applications.
  - VS Code also supplies a graphical user interface for working with Git.
  - The following VS Code extensions can also be quite helpful:
    - [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) (use the [@bentley/eslint-plugin](https://www.npmjs.com/package/@bentley/eslint-plugin) to enforce Bentley coding standards)
    - [Debugger for Chrome](https://marketplace.visualstudio.com/items?itemName=msjsdiag.debugger-for-chrome)
    - [GitLens](https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens) (great tools for using Git inside VS Code)
    - [MarkdownLint](https://marketplace.visualstudio.com/items?itemName=DavidAnson.vscode-markdownlint) (for editing documentation)

## Recommended reading

- [TypeScript](http://www.typescriptlang.org/)
  - iTwin.js applications are written in TypeScript and then _compiled_ to plain JavaScript.
- [Node Package Manager (npm)](https://www.npmjs.com/)
  - `npm` is used to install and manage dependencies of an iTwin.js application.
  - The `npm` [command line](https://docs.npmjs.com/cli/npm) and `npm` [scripts](https://docs.npmjs.com/misc/scripts) are used to build and test iTwin.js applications.
