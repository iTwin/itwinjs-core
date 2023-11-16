# Learning iTwin.js UI

## AppUI

AppUI is a framework for writing iTwin.js apps. For details, see this [overview](./appui/index).

For a quick-start approach to creating an iTwin.js app with App UI, see [Quick Start to an App UI user interface](./QuickStartUi.md).

## React version requirements

AppUI bases its controls on the [React](https://reactjs.org/) JavaScript library and is compatible with React 17.0 and later.

## Library Organization

The iTwin.js UI library is divided into these NPM packages in the `@itwin` scope:

|Package Name|Description
|-----|-----
|[appui-abstract](./abstract/index)|Abstractions for UI controls and items.
|[core-react](./core/index)|General purpose React components that can be used outside AppUI apps.
|[components-react](./components/index)|React components that are data-oriented, such as PropertyGrid and Tree.
|[imodel-components-react](./imodel-components/index)|React components that depend on iTwin.js, like core-frontend, core-common or core-quantity packages. The components pertain to Color, Cube, LineWeight, Navigation Aids, Quantity Inputs, Timeline and Viewport.
|[appui-react](./appui-react/index)|Classes and components for specifying the application UI consisting of the Backstage, Frontstages, Content Views, Tool Bars, Status Bars, Widgets and Panels.

See also:

- [Creating an IModelApp that supports Extensible UI](./HostAppUI.md).
- [Augmenting the UI of an iTwin App](./AugmentingUI.md).
- [Glossary of terms used in AppUI](./UIGlossary)
- [React](https://reactjs.org/)
- [Redux](https://redux.js.org/)
- [React and Typescript](https://github.com/typescript-cheatsheets/react-typescript-cheatsheet/)
