# Getting started (online quick start)

## 1. Get the tools

Writing an iModel.js application requires the following software:

- [Node.js](https://nodejs.org) (12.x LTS version)
  - This provides the backend JavaScript runtime.
  - The installation also includes the `npm` command line tool.
- [Google Chrome](https://www.google.com/chrome/)
  - This is the preferred tool for developing and debugging frontend JavaScript.
- [Git](https://git-scm.com/downloads)
  - This is the source code control system for the iModel.js repositories.

### Suggested IDE

- [Visual Studio Code](https://code.visualstudio.com/)
  - This is the recommended editor and debugger for iModel.js applications.
  - VS Code also supplies a GUI for working with Git.

## 2. Get a sample iModel

[Click here and use the registration dashboard to create a new iModel](/getting-started/registration-dashboard?tab=1&create=bentleyExample)

## 3. Get the sample code

The samples are included in the [imodeljs-samples](https://github.com/imodeljs/imodeljs-samples) repo on GitHub. For a complete list of samples see the README.

> `git clone https://github.com/imodeljs/imodeljs-samples.git`

## 4. Configure

Edit imodeljs-samples/interactive-app/basic-viewport-app/.env.local
  > `imjs_test_imodel` =  The name of your iModel created in step 2<br/>

## 5. Build and run a sample app

> `cd interactive-app`

> `cd basic-viewport-app`

> `npm install`

> `npm run build`

> `npm run start:servers`

&nbsp;
&nbsp;
---

## Next Steps

### [Follow tutorials to dive deeper into iModel.js]($docs/learning/tutorials/index.md)

### [iModel.js Blog](https://medium.com/imodeljs)

### Read [imodeljs-samples](https://github.com/imodeljs/imodeljs-samples) READMEs, and review code


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