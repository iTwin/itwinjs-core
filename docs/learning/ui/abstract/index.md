# The ui-abstract package

The ui-abstract package contains abstractions for UI controls and items, such as Toolbar, Button, Menu, Backstage, StatusBar and Widget.
The imodeljs-frontend package, as well as ui-core, has a dependency on the ui-abstract package.
Therefore, code in imodeljs-frontend can use classes and interfaces in ui-abstract.

## Topics

- [Backstage](./Backstage.md) - Abstractions used by ui-framework package to create and manage the display of Backstage menu items.
- [DialogItem](./DialogItem.md) - Interfaces used by UiLayoutDataProvider to create UI automatically for use in App UI apps.
- [Item](./Item.md) - Classes for working with an Item in a Toolbar, Widget, Backstage or Context Menu.
- [Properties](./Properties.md) - Interfaces and classes to create UI editors for Property data.
- [StatusBar](./StatusBar.md) - Classes for creating and managing items in the status bar.
- [Toolbar](./Toolbar.md) - Classes for creating and managing items in a toolbar.
- [UiAdmin](./UiAdmin.md) - Abstractions for UI controls, such as toolbars, buttons and menus and are callable from IModelApp.uiAdmin in imodeljs-frontend.
- [UiItemsProvider](./UiItemsProvider.md) - Classes and interfaces for specifying UI items to be inserted at runtime.
- [UiDataProvider](./UiDataProvider.md) - Data synchronization for apps that directly create UI with React or other UI libraries.
- [Utilities](./Utilities.md) - Various utility classes for working with a UI.
