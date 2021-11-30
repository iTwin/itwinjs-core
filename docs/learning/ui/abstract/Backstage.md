# Backstage

The [Backstage]($appui-abstract:Backstage) is a menu used to open frontstages, launch tasks, and execute commands. It can also open full-screen overlays, called modal stages, presenting application settings and data management to the user. The [Backstage]($appui-abstract:Backstage) category in the `@itwin/appui-abstract` package contains abstractions used by the `@itwin/appui-react` package to create and manage the display of Backstage menu items.

## Backstage Item Utilities

[BackstageItemUtilities]($appui-abstract) is a utility class to create abstract Backstage item definitions that define entries in the Backstage menu.

The following shows an example of defining an item to create an item that opens a primary stage.

```ts
BackstageItemUtilities.createStageLauncher("IModelIndex", 200, 20, IModelApp.i18n.translate("SampleApp:backstage.imodelindex"), undefined, "icon-placeholder"),
```

The following shows an example of defining an item that executes an action.

```ts
BackstageItemUtilities.createActionItem("SampleApp.settings", 300, 10, () => FrontstageManager.openModalFrontstage(new SettingsModalFrontstage()), IModelApp.i18n.translate("SampleApp:backstage.testFrontstage6"), undefined, "icon-placeholder"),
```

In both examples, the first parameter is a key for the backstage item. This key must be unique across all other backstage items. The next two parameters define the group priority and the item priority within the group.  These values are use to determine the order of the item in the menu. This method allows other packages and extensions to insert items at specific positions within the menu.  It is recommended that the host application increment group priority by 100 and item priority by 10 to provide sufficient gaps for additional groups and items. The ordering is done from lowest to highest priority values.

See additional example in [Backstage](../../../learning/ui/framework/Backstage.md).

## API Reference

- [Backstage]($appui-abstract:Backstage)
