# The appui-abstract package

The appui-abstract package contains abstractions for UI controls and items, such as Toolbar, Button, Menu, Backstage, StatusBar and Widget.
The core-frontend package, as well as core-react, has a dependency on the appui-abstract package.
Therefore, code in core-frontend can use classes and interfaces in appui-abstract.

## Topics

- [Backstage](./Backstage.md) - Abstractions used by appui-react package to create and manage the display of Backstage menu items.
- [DialogItem](./DialogItem.md) - Interfaces used by UiLayoutDataProvider to create UI automatically for use in AppUi apps.
- [Item](./Item.md) - Classes for working with an Item in a Toolbar, Widget, Backstage or Context Menu.
- [Properties](./Properties.md) - Interfaces and classes to create UI editors for Property data.
- [StatusBar](./StatusBar.md) - Classes for creating and managing items in the status bar.
- [Toolbar](./Toolbar.md) - Classes for creating and managing items in a toolbar.
- [UiAdmin](./UiAdmin.md) - Abstractions for UI controls, such as toolbars, buttons and menus and are callable from IModelApp.uiAdmin in core-frontend.
- [UiItemsProvider](./UiItemsProvider.md) - Classes and interfaces for specifying UI items to be inserted at runtime.
- [UiDataProvider](./UiDataProvider.md) - Data synchronization for apps that directly create UI with React or other UI libraries.
- [Utilities](./Utilities.md) - Various utility classes for working with a UI.
