# Learning iModel.js UI

This section provides explanations of the concepts you'll encounter in iModel.js UI.

## JavaScript vs. TypeScript

iModel.js UI uses [TypeScript](https://www.typescriptlang.org/). While many React applications are written using JavaScript, for easy integration with the iModel.js library, we strongly recommend using TypeScript. For more information, see [Learning iModel.js](https://imodeljs.github.io/iModelJs-docs-output/Learning/)

## Javascript Version Requirements

The iModel.js UI library requires a JavaScript engine with es2017 support.

## React version requirements

iModel.js UI is compatible with React 16.2 and later

## Helpful articles:

* [Core](./core/index)
* [Components](./components/index)
* [Nine Zone](./ninezone/index)
* [Framework](./framework/index)
* [BWC](./bwc/index)

See also:

* [Glossary of terms used in iModel.js UI](./Glossary)
* [Frequently asked Questions](./faq)

## Library Organization

The iModel.js UI library is divided into these NPM packages in the `@bentley` scope:

|Package Name|Description
|-----|-----
|**ui&#8209;core**|General purpose React components, such as Dialog, MessageBox, SearchBox, RadialMenu and SplitButton.
|**ui&#8209;components**|React components that are data-oriented, such as PropertyGrid, Table, Tree and Breadcrumb.
|**ui&#8209;ninezone**|React components for application user interface layouts following the Bentley 9&#8209;Zone pattern.
|**ui&#8209;framework**|Application fragments for Login, Project, iModel and View selection, and configuration of the application UI including the Backstage, Frontstages, Widgets, etc.
|**bwc**|Sass/SCSS library and React components for building standardized Bentley user interfaces.

## Application UI Configuration

There are numerous React components and TypeScript classes in the ui&#8209;framework NPM package for configuring the application user interface. The following are defined using these classes:

* Backstage
* Frontstages
* Content Groups
* Content Layouts
* Content Views
* Widgets
* Dialogs
* Status Bars and Fields
* Navigation Aids
* Tool Settings
* Tasks
* Workflows
