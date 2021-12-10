# Learning iTwin.js UI

## AppUi

AppUi is a framework for writing iTwin.js apps. For details, see this [overview](./appui/index).

For a quick-start approach to creating an iTwin.js app with App UI, see [Quick Start to an App UI user interface](./QuickStartUi.md).

## React version requirements

iTwin.js UI bases its controls on the [React](https://reactjs.org/) JavaScript library and is compatible with React 17.0 and later.

## Library Organization

The iTwin.js UI library is divided into these NPM packages in the `@bentley` scope:

|Package Name|Description
|-----|-----
|[appui&#8209;abstract](./abstract/index)|Abstractions for UI controls and items, such as Toolbar, Button, Menu, Backstage, StatusBar and Widget.
|[core&#8209;react](./core/index)|General purpose React components that can be used outside AppUi apps.
|[components&#8209;react](./components/index)|React components that are data-oriented, such as PropertyGrid, Table and Tree.
|[imodel&#8209;components&#8209;react](./imodel&#8209;components/index)|React components that depend on the imodeljs-frontend, imodeljs-common or imodeljs-quantity packages. The components pertain to Color, Cube, LineWeight, Navigation Aids, Quantity Inputs, Timeline and Viewport.
|[appui&#8209;react](./appui/appui&#8209;react/index)|Classes and components for specifying the application UI consisting of the Backstage, Frontstages, Content Views, Tool Bars, Status Bars, Widgets and Panels.

See also:

- [Creating an IModelApp that supports Extensible UI](./HostAppUI.md).
- [Augmenting the UI of an iTwin App](./AugmentingUI.md).
- [Glossary of terms used in AppUi](./UIGlossary)
- [React](https://reactjs.org/)
- [Redux](https://redux.js.org/)
- [React and Typescript](https://github.com/typescript-cheatsheets/react-typescript-cheatsheet/)
