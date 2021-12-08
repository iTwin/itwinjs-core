# Augmenting the UI of an iTwin App

There are two basic ways to augment the UI of a host iModelApp.

The simplest way is to use one or more `UiItemsProvider` to provide definitions for Tool buttons, Status Bar items, Backstage items, and Widgets.  In this scenario, as frontstage components are constructed at runtime, calls are made to all registered UiItemsProviders to gather item definitions to insert into the host iModelApp.

The second way is for a package to provide an entire stage definition. It is recommended that this be done using the [StandardFrontstageProvider]($appui-react), which will provide an empty stage that can then be populated via UiItemsProviders.

A recommended technique is for a package to have an initialize() method that registers its Tools and UiItemsProvider. See this approach in example below.

```ts
  private static registerUiComponents(): void {
    SampleTool.register(MyPackage.localizationNamespace);
    GenericTool.register(MyPackage.localizationNamespace);

    // register to add items to "General" usage stages"
    UiItemsManager.register(new MyUiItemsProvider());
  }

  public static async initialize(): Promise<void> {
    if (this._initialized)
      return;

    /** Register the localized strings for this package
     * We'll pass the localization member to the rest of the classes in the package to allow them to translate strings in the UI they implement.
     */
    await IModelApp.localization.registerNamespace(MyPackage.localizationNamespace);
    this.registerUiComponents();
    this._initialized = true;
  }
```

## Adding ToolButtons, Status Bar items, and Widgets to existing application frontstage

A [UiItemsProvider]($appui-abstract) is used to provide items to insert into the UI of an existing stage. When App UI is constructing the stage, item definitions are requested from all UiItemsProviders. These calls will always include the current frontstage's Id and usage. A package can use this info to determine which, if any, items to add to the stage. An application's stageId names may not be useful unless the stage names are already known to the UiItemsProvider. The stageUsage value is also provided. This string is typically set to one of the standard [StageUsage]($appui-abstract) enum values. Each provider also receives the stage's applicationData. This allows the frontstage to specify a list of features that it is intended to support.

One important note. When specifying an item via a UiItemsProvider please ensure that its Id is uniquely specified across all applications that may use items from the provider. One way to do this is to prefix the id with a string that represents the package. A common pattern is `package-name:item-id`.

### Adding a ToolButton

A UiItemsProvider can return an array of [CommonToolbarItem]($appui-abstract) that are used when populating the four different toolbars supported by App UI. The [ToolbarUsage]($appui-abstract) will indicate if the toolbar is on the left (content manipulation) or right (view navigation) of the application window. The [ToolbarOrientation]($appui-abstract) specifies if the toolbar is horizontal or vertical. The item priority determines the order of the tool button items within a group. A group priority can optionally be defined for the tools. If the group priority is defined, tools are placed into groups with a separator displayed when the group priority changes. The default value for group priority is zero.

Below is the UiItemsProvider function called when appui-react is populating toolbars.

```ts
public provideToolbarButtonItems(stageId: string, stageUsage: string,
  toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): CommonToolbarItem[]
```

### Status Bar Item

A UiItemsProvider can return an array of [CommonStatusBarItem]($appui-abstract) to insert into the StatusBar. The item's definition includes the StatusBar section to be placed in and a priority defining its order within the section. Below is the UiItemsProvider function called when appui-react is populating the status bar footer.

```ts
public provideStatusBarItems(stageId: string, stageUsage: string): CommonStatusBarItem[]
```

### Widget Item

The UiItemsProvider function called when appui-react is populating StagePanels is detailed below. The [StagePanelLocation]($appui-abstract) will be the default location for the widget. The [StagePanelSection]($appui-abstract) will specify what section of the panel should contain the widget. Since widgets can be moved by the user, the locations specified are only the default locations.

```ts
public provideWidgets(stageId: string, _stageUsage: string, location: StagePanelLocation,
  _section?: StagePanelSection | undefined): ReadonlyArray<AbstractWidgetProps>
```

Starting in version 2.17 Widgets can support being "popped-out" to a child window by setting the AbstractWidgetProps property `canPopout` to true. This option must be explicitly set because the method `getWidgetContent` must return React components that works properly in a child window. At minimum  components should typically not use the `window` or `document` property to register listeners as these listener will be registered for events in the main window and not in the child window. Components will need to use the `ownerDocument` and `ownerDocument.defaultView` properties to retrieve `document` and `window` properties for the child window.

To see a more complete example of adding ToolButtons, Status Bar items, and Widgets see the [UiItemsProvider example](./abstract/uiitemsprovider/#uiitemsprovider-example).

## Adding a Frontstage

 The follow example shows how to define a new stage and register it with the `ConfigurableUiManager`. This stage defines the content to show and leaves all the tool and status bar item specifications to standard providers. This stage could then be registered in the package's initialize method by calling `MyFrontstage.register()`.

``` ts
export class MyStageContentGroupProvider extends ContentGroupProvider {
  public async provideContentGroup(props: FrontstageProps): Promise<ContentGroup> {
    return new ContentGroup({
      id: "myPackage:my-stage-content",
      layout: StandardContentLayouts.singleView,
      contents: [
        {
          id: "primaryContent",
          classId: IModelViewportControl.id,
          applicationData: {
            isPrimaryView: true,
            supports: ["viewIdSelection", "3dModels", "2dModels"],
            viewState: UiFramework.getDefaultViewState,
            iModelConnection: UiFramework.getIModelConnection,
          },
        },
      ],
    });
  }
}

export class MyFrontstage {
  public static stageId = "myPackage:MyStageId";
  private static _contentGroupProvider = new MyStageContentGroupProvider();
  public static register() {
    const cornerButton = <BackstageAppButton icon={"icon-bentley-systems"} />;
    const myStageProps: StandardFrontstageProps = {
      id: NetworkTracingFrontstage.stageId,
      version: 1.0,  // stage version used when save stage's state
      contentGroupProps: MyFrontstage._contentGroupProvider,
      hideNavigationAid: false,
      cornerButton,
      usage: StageUsage.Private,
      applicationData: undefined,
    };

    ConfigurableUiManager.addFrontstageProvider(new StandardFrontstageProvider(myStageProps));
    MyFrontstage.registerToolProviders();
  }

  private static registerToolProviders() {
    // Provides standard tools for ToolWidget in ui2.0 stage
    StandardContentToolsProvider.register({
      horizontal: {
        clearSelection: true,
        clearDisplayOverrides: true,
        hide: "group",
        isolate: "group",
        emphasize: "element",
      },
    }, (stageId: string, _stageUsage: string, _applicationData: any) => {
      return stageId === MyFrontstage.stageId;
    });

    // Provides standard tools for NavigationWidget in ui2.0 stage
    StandardNavigationToolsProvider.register(undefined, (stageId: string, _stageUsage: string, _applicationData: any) => {
      return stageId === MyFrontstage.stageId;
    });

    // Provides standard status fields for ui2.0 stage
    StandardStatusbarItemsProvider.register(undefined, (stageId: string, _stageUsage: string, _applicationData: any) => {
      return stageId === MyFrontstage.stageId;
    });
  }
}

```

## StateManager and ReducerRegistry

The example below shows the call that adds a Reducer to the store managed by the StateManager. This registration should be made by the package when it loads or by a package when it is initialized.

```ts
ReducerRegistryInstance.registerReducer(
  PackageStateManager._reducerName,
  PackageStateManager.reducer,
);
```

See complete [example](./appui/appui&#8209;react/State.md##example&#8209;of&#8209;defining&#8209;dynamic&#8209;reducer&#8209;needed&#8209;by&#8209;a&#8209;package).
