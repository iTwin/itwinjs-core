# appui-test-providers

Copyright © Bentley Systems, Incorporated. All rights reserved. See LICENSE.md for license terms and full copyright notice.

This is an example of a package that can be added to provide tools and augment the UI in an iModelApp. When initialized this package will register different stages and UiItemProviders to provide tools, widgets, and status bar items to the stages. See <http://itwinjs.org> for comprehensive documentation on the iTwin.js API and the various constructs used in this test.

Included in this package are:

- `SampleTool` that shows how to implement a tool with tool settings.
- `GenericLocateTool` that shows how to implement a tool that requires user to first locate an element.
- `OpenAbstractDialogTool` that shows how to generate a dialog without creating "react" components.
- `AbstractUiItemsProvider` that provide tool buttons and a status bar item to stages set usage set to "StageUsage.General"
- `NetworkTracingFrontstage` that defines a new stage to add to iModelApp.
- `NetworkTracingUiItemsProvider` that provide tool buttons and widgets to NetworkTracingFrontstage.
- `TestProviderState` that define package specific state properties to add to the apps Redux store.
- `CustomContentFrontstage` that define a frontstage the show an iModel view and a custom content view populated via `SampleCustomContent`

## Development Setup

1. The test applications appui-standalone-app and appui-connected-app serves as the default an iTwin.js host applications and is already set up to take a dependency on this package.

2. Start either appui-standalone-app or appui-connected-app to see the items and stages provided by this package.

## Contributing

[Contributing to iTwin.js](https://github.com/iTwin/itwinjs-core/blob/master/CONTRIBUTING.md)
