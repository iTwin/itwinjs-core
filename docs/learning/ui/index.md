# Learning iTwin.js UI

For a quick-start approach to creating an iTwin.js app with App UI, see [Quick Start to an App UI user interface](./QuickStartUi.md).

## React version requirements

iTwin.js UI bases its controls on the [React](https://reactjs.org/) JavaScript library and is compatible with React 16.8 and later.

## Library Organization

The iTwin.js UI library is divided into these NPM packages in the `@bentley` scope:

|Package Name|Description
|-----|-----
|[ui&#8209;abstract](./abstract/index)|Abstractions for UI controls and items, such as Toolbar, Button, Menu, Backstage, StatusBar and Widget.
|[ui&#8209;core](./core/index)|General purpose React components, such as Input, Button, Dialog, MessageBox, SearchBox, RadialMenu and SplitButton.
|[ui&#8209;components](./components/index)|React components that are data-oriented, such as PropertyGrid, Table, Tree and Breadcrumb.
|[ui&#8209;ninezone](./ninezone/index)|React components for application user interface layouts following the Bentley 9&#8209;Zone pattern.
|[ui&#8209;framework](./framework/index)|Application fragments for Login, Project, iModel and View selection, and configuration of the application UI including the Backstage, Frontstages, Zones, Widgets, etc.

See also:

- [Creating an IModelApp that supports Extensible UI](./HostAppUI.md).
- [Augmenting the UI of an iTwin App](./AugmentingUI.md).
- [Glossary of terms used in iTwin.js UI](./UIGlossary)
- [React](https://reactjs.org/)
- [Redux](https://redux.js.org/)
- [React and Typescript](https://github.com/typescript-cheatsheets/react-typescript-cheatsheet/)
- [Why we chose React](./React.md)
