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

A [UiItemsProvider]($appui-react) is used to provide items to insert into the UI of an existing stage. When App UI is constructing the stage, item definitions are requested from all UiItemsProviders. These calls will always include the current frontstage's Id and usage. A package can use this info to determine which, if any, items to add to the stage. An application's stageId names may not be useful unless the stage names are already known to the UiItemsProvider. The stageUsage value is also provided. This string is typically set to one of the standard [StageUsage]($appui-react) enum values. Each provider also receives the stage's applicationData. This allows the frontstage to specify a list of features that it is intended to support.

One important note. When specifying an item via a UiItemsProvider please ensure that its Id is uniquely specified across all applications that may use items from the provider. One way to do this is to prefix the id with a string that represents the package. A common pattern is `package-name:item-id`.

### Adding a ToolButton

A UiItemsProvider can return an array of [ToolbarItem]($appui-react) that are used when populating the four different toolbars supported by App UI. The [ToolbarUsage]($appui-react) will indicate if the toolbar is on the left (content manipulation) or right (view navigation) of the application window. The [ToolbarOrientation]($appui-react) specifies if the toolbar is horizontal or vertical. The item priority determines the order of the tool button items within a group. A group priority can optionally be defined for the tools. If the group priority is defined, tools are placed into groups with a separator displayed when the group priority changes. The default value for group priority is zero.

Below is the UiItemsProvider function called when appui-react is populating toolbars.

```ts
public provideToolbarButtonItems(stageId: string, stageUsage: string,
  toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): ToolbarItem[]
```

### Status Bar Item

A UiItemsProvider can return an array of [StatusBarItem]($appui-react) to insert into the StatusBar. The item's definition includes the StatusBar section to be placed in and a priority defining its order within the section. Below is the UiItemsProvider function called when appui-react is populating the status bar footer.

```ts
public provideStatusBarItems(stageId: string, stageUsage: string): StatusBarItem[]
```

### Widget Item

The UiItemsProvider function called when appui-react is populating StagePanels is detailed below. The [StagePanelLocation]($appui-react) will be the default location for the widget. The [StagePanelSection]($appui-react) will specify what section of the panel should contain the widget. Since widgets can be moved by the user, the locations specified are only the default locations.

```ts
    provideWidgets(stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection): ReadonlyArray<Widget>;
```

Widgets can support being "popped-out" to a child window by setting the Widget property `canPopout` to true. This option must be explicitly set because the method `getWidgetContent` must return React components that works properly in a child window. At minimum  components should typically not use the `window` or `document` property to register listeners as these listener will be registered for events in the main window and not in the child window. Components will need to use the `ownerDocument` and `ownerDocument.defaultView` properties to retrieve `document` and `window` properties for the child window.

Below is an example of implementation of a `provideWidgets` method.

```tsx
  public provideWidgets(_stageId: string, stageUsage: string, location: StagePanelLocation, section: StagePanelSection | undefined): ReadonlyArray<Widget> {
    const widgets: Widget[] = [];
    if (stageUsage === StageUsage.General && location === StagePanelLocation.Right && section === StagePanelSection.End) {
      {
        widgets.push({
          id: PresentationPropertyGridWidgetControl.id,
          icon: PresentationPropertyGridWidgetControl.iconSpec,
          label: PresentationPropertyGridWidgetControl.label,
          defaultState: WidgetState.Open,
          canPopout: true,
          defaultFloatingSize={{width:330, height:540}},
          isFloatingStateWindowResizable={true},
          getWidgetContent: () => <PresentationPropertyGridWidget />,
        });
      }
    }
    return widgets;
  }
}
```

One last thing to point out in the above example. We specified default size for the widget if it is "floated". This is sometimes required due to the specific construction of the widget component. Most components have an intrinsic size based on their contents and this size is used when the widget is floated. There are a few widget that draw directly to a canvas object or some other object that does not have an intrinsic size, and these component must have a size specified. Widgets that use the `PropertyGrid` and `ControlledTree` components are of this type and must have their sizes specified. The `defaultFloatingSize` prop is used to specify a default size for these widgets when they are "floated". If the prop `isFloatingStateWindowResizable={true}` is also specified the user is allowed to resize the widgets when floated and that stated is saved and used if the widget is floated again in the same frontstage.

## UiItemsProviderOverrides

When registering a [UiItemsProvider]($appui-react) with the [UiItemsManager]($appui-react) it is possible to pass an additional argument to limit when the provider is allowed to provide its items. The interface [UiItemsProviderOverrides]($appui-react) defines the parameters that can be used to limit when the provider is called to provide its items.

In the example registration below the `commonToolSetProvider` is limited to be called to when the active stage has a StageUsage: `StageUsage.General`, `StageUsage.Edit`, or `StageUsage.ViewOnly`. Remember the StageUsage is defined by the FrontStageProvider that has been registered.  Since we want the same provider to provide a different set of tools to different stages we assign an override providerId for this instance of the provider. This is needed since the UiItemsManager does not allow providers with duplicate Ids. The `redlineToolSetProvider` is then registered to show only a subset of tools when the active stage has a StageUsage of `StageUsage.Redline`.

```ts
const commonToolSetProvider = new StandardContentToolsUiItemsProvider();
UiItemsManager.register(commonToolSetProvider, {providerId: "general-content-tools",
 stageUsages: [StageUsage.General, StageUsage.Edit, StageUsage.ViewOnly]});

const contentToolsToShow: DefaultContentTools = {
      vertical: {
        selectElement: true,
      },
      horizontal: {
        clearSelection: true,
      },
    };
const redlineToolSetProvider = new StandardContentToolsUiItemsProvider(contentToolsToShow);
UiItemsManager.register(redlineToolSetProvider, {providerId: "redline-content-tools",
  stageUsages: [StageUsage.Redline]});
```

Alternately StageIds could be used to specify when the different tool set providers are used. This requires the caller the registers the UiItemsProvider to know all stageIds that are available in the application.

```ts
const commonToolSetProvider = new StandardContentToolsUiItemsProvider();
UiItemsManager.register(commonToolSetProvider, {providerId: "general-content-tools",
 stageIds: ["Main", "PlanAndProfile", "BasicEditing"]});

const contentToolsToShow: DefaultContentTools = {
      vertical: {
        selectElement: true,
      },
      horizontal: {
        clearSelection: true,
      },
    };
const redlineToolSetProvider = new StandardContentToolsUiItemsProvider(contentToolsToShow);
UiItemsManager.register(redlineToolSetProvider, {providerId: "redline-content-tools",
  stageIds: ["Markup"]});
```

There are three standard providers that can be used to serve as example of defining a UiItemsProvider. They are [StandardContentToolsUiItemsProvider]($appui-react), [StandardNavigationToolsUiItemsProvider]($appui-react), and [StandardStatusbarUiItemsProvider]($appui-react).

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

    // =============== using stage ids to filter when provider is called ===================
    const contentToolOptions = {
        horizontal: {
          clearSelection: true,
          clearDisplayOverrides: true,
          hide: "group",
          isolate: "group",
          emphasize: "element",
        },
      };

    UiItemsManager.register(new StandardContentToolsUiItemsProvider(contentToolOptions), {stageIds: ["myPackage:MyStageId", "MainStage", "IssueResolution"]});
    UiItemsManager.register(new StandardNavigationToolsUiItemsProvider(), {stageIds: ["myPackage:MyStageId", "MainStage", "IssueResolution"]});
    UiItemsManager.register(new StandardStatusbarItemsProvider(), {stageIds: ["myPackage:MyStageId", "MainStage", "IssueResolution"]});
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

See complete [example](./appui-react/State.md#example-of-defining-dynamic-reducer-needed-by-a-package).
