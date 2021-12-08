# Quick Start to an App UI user interface

## Use create-react-app to make a Web Viewer app

The create-react-app utility makes a simple React app. iTwin.js provides a template that allows create-react-app to create a React app that is a simple iTwin Viewer app.

Full instructions for creating a Web Viewer using create-react-app can be found here:

[Developing a web viewer](../tutorials/develop-web-viewer.md)

## Modify the basic Frontstage

iTwin's App UI organizes functionality into [Frontstages](./appui/appui&#8209;react/Frontstages.md). Because the iTwin Viewer template for create-react-app provides a basic Frontstage, the quickest way to get started with a new app is to add your app's UI to that Frontstage with the [UiItemsProvider](./abstract/UiItemsProvider.md). This will add you tool buttons, [StatusBar](./appui/appui&#8209;react/StatusBar.md) items, [Backstage](./appui/appui&#8209;react/Backstage.md) items, and [Widgets](./appui/appui&#8209;react/Widgets.md) to the basic viewer when the application loads.

A more detailed explanation of using the UiItemsProvider interface can be found here: [Augmenting the UI of an iTwin App](./AugmentingUI.md).

## Building a new Frontstage

If you find that you need to make more drastic modifications to the delivered Frontstage, you may need to create a new Frontstage. This [Frontstage](./appui/appui&#8209;react/Frontstages.md) sample can be used as a template for your app's Frontstage. From there, the new Frontstage can be added to your App at startup using a FrontstageProvider. Details in [Adding a Frontstage](./AugmentingUI.md#Adding-a-Frontstage).
