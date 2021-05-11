# Augmenting the UI of an iTwin App

There are two basic ways to augment the UI of a host IModelApp. The first way is for an extension or a package to provide an entire stage definition and call `ConfigurableUiManager.addFrontstageProvider` to register it. A [UiItemsProvider]($ui-abstract) may also need to be registered if the backstage is to be used to activate the frontstage. The second way is to use a `UiItemsProvider` to provide definitions for Tool buttons, Status Bar items, and Widgets to add to an existing frontstage. In this scenario, as frontstage components are constructed at runtime, calls are made to all registered UiItemsProviders to gather item definitions to insert into the host applications UI. The item definitions are sorted and arranged by their itemPriority value.

## Adding ToolButtons, Status Bar items, and Widgets to existing application frontstage

A [UiItemsProvider]($ui-abstract) is used to provide items to insert into the UI of an existing stage. When constructing the stage the ui-framework code will request item definitions from the UiItemsProvider. These calls will always include the current frontstage's Id and usage. An extension can use the info to decide which items to add. The stageId name's used by an application may not be useful unless the extension is just used in a single host app where the stage names are known. The stageUsage value is also provided, this string is typically set to one of the standard [StageUsage]($ui-abstract) enum values.

### Adding a ToolButton

Below is the UiItemsProvider function called when ui-framework is populating toolbars.  The [ToolbarUsage]($ui-abstract) will indicate if the toolbar is on the left (content manipulation) or right (view navigation) of the application window. The [ToolbarOrientation]($ui-abstract) specifies if the toolbar is horizontal or vertical.

```ts
public provideToolbarButtonItems(stageId: string, stageUsage: string,
  toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): CommonToolbarItem[]
```

### Status Bar Item

Below is the UiItemsProvider function called when ui-framework is populating the status bar footer.

```ts
public provideStatusBarItems(stageId: string, stageUsage: string): CommonStatusBarItem[]
```

### Widget Item

Below is the UiItemsProvider function called when ui-framework is populating StagePanels. The [StagePanelLocation]($ui-abstract) will be the default location for the widget. The [StagePanelSection]($ui-abstract) will specify what zone/area in the panel should contain the widget. Since widgets can be moved by the user, the locations specified are only the default locations.

```ts
public provideWidgets(stageId: string, _stageUsage: string, location: StagePanelLocation,
  _section?: StagePanelSection | undefined): ReadonlyArray<AbstractWidgetProps>
```

To see a more complete example of adding ToolButtons, Status Bar items, and Widgets see the [UiItemsProvider example](./abstract/uiitemsprovider/#uiitemsprovider-example).

## Adding a Frontstage

Register [FrontstageProvider]($ui-framework)

```ts
ConfigurableUiManager.addFrontstageProvider(new MyFrontstageProvider());
```

Create [UiItemsProvider]($ui-abstract) to provide the backstage entry.

```ts
export class MyUiItemProvider {
  /** id of provider */
  public readonly id = "MyUiItemProvider";
  private static _i18n: I18N;
  constructor(i18n: I18N) {
    MyUiItemProvider.i18n = i18n;
  }

  public provideBackstageItems(): BackstageItem[] {
    const label = MyUiItemProvider._i18n.translate("myExtension:backstage.myFrontstageName");

    return [
      BackstageItemUtilities.createStageLauncher(MyFrontstageProvider.id, 100, 10, label, undefined, undefined),
    ];
  }
}
```

Register the UiItemsProvider.

```ts
UiItemsManager.register(new MyUiItemProvider(IModelApp.i18n));
```

## StateManager and ReducerRegistry

The example below shows the call that adds a Reducer to the store managed by the StateManager. This registration should be made by the extension when it loads or by a package when it is initialized.

```ts
ReducerRegistryInstance.registerReducer(
  ExtensionStateManager._reducerName,
  ExtensionStateManager.reducer,
);
```

See complete [example](./framework/state/#example-of-defining-dynamic-reducer-needed-by-a-plugin).
