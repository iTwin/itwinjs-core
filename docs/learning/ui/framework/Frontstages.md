# Frontstages

A **Frontstage** is a full-screen configuration designed to enable the user to accomplish a task. There are three types of frontstages:

|Type|Description
|-----|-----
|**Primary** | may use all zones and stage panels and the Tool Widget contains the App button that opens the App menu
|**Nested** | is accessed from a primary frontstage. It may use all zones and panels, but instead of the App button, the Tool Widget contains a Back button to return to the primary frontstage.
|**Modal** | is accessed from another frontstage or the Backstage. It may contain any content along with a Back button. It does not use zones or stage panels. It is useful for application settings and data management user interfaces.

## Frontstages in App UI

With the release of the `iTwin.js 2.0`, new UI components are available that provide a new look and feel for iTwin Apps. The new look and feel was initially referred to as `UI 2.0` and now has the more formal name of a `App UI`. The two primary goals of `App UI` are to limit the amount of UI components that obscure the iModel content and to ensure that Extensions can augment the UI provided by the host IModelApp.

Below is an example frontstage that shows the different areas/zones.

![FrontstageUi2](./images/FrontstageUi2.png "App UI Frontstage design")

A frontstage is can be configured in a class subclassing the [FrontstageProvider]($appui-react) abstract class, but the recommended way is to build it using UiProviders, as in the example below .

### Example Frontstage definition

The definition that produces the sample frontstage is shown below.

```tsx
export class FrontstageUi2 {
  private static _contentGroupProvider = new FrontstageUi2ContentGroupProvider();
  private static showCornerButtons = true;

  public static supplyAppData(_id: string, _applicationData?: any) {
    return {
      viewState: UiFramework.getDefaultViewState,
      iModelConnection: UiFramework.getIModelConnection,
    };
  }

  public static register() {
    // set up custom corner button where we specify icon, label, and action
    const cornerButton = FrontstageUi2.showCornerButtons ?
      <BackstageAppButton key="ui2-backstage" label="Toggle Ui2 Backstage" icon={"icon-bentley-systems"}
        execute={() => BackstageManager.getBackstageToggleCommand().execute()} /> : undefined;
    const hideNavigationAid = !FrontstageUi2.showCornerButtons;
    const setUpCustomToolGroups = true;
    const applicationData = setUpCustomToolGroups ? {
      defaultContentTools: {
        vertical: {
          selectElementGroupPriority: 100,
          measureGroupPriority: 200,
          selectionGroupPriority: 300,
        },
        horizontal: {
          clearSelectionGroupPriority: 100,
          overridesGroupPriority: 200,
        },
      },
    } : undefined;

    const ui2StageProps: StandardFrontstageProps = {
      id: "Ui2",
      version: 1.1,
      contentGroupProps: FrontstageUi2._contentGroupProvider,
      hideNavigationAid,
      cornerButton,
      usage: StageUsage.General,
      applicationData,
    };

    ConfigurableUiManager.addFrontstageProvider(new StandardFrontstageProvider(ui2StageProps));
    this.registerToolProviders();
  }

  private static registerToolProviders() {

    // Provides standard tools for ToolWidget in ui2.0 stage
    StandardContentToolsProvider.register("ui2-standardContentTools", {
      horizontal: {
        clearSelection: true,
        clearDisplayOverrides: true,
        hide: "group",
        isolate: "group",
        emphasize: "element",
      },
    }, (stageId: string, _stageUsage: string, _applicationData: any) => {
      return stageId === "Ui2";
    });

    // Provides standard tools for NavigationWidget in ui2.0 stage
    StandardNavigationToolsProvider.register("ui2-standardNavigationTools", undefined, (stageId: string, _stageUsage: string, _applicationData: any) => {
      return stageId === "Ui2";
    });

    // Provides standard status fields for ui2.0 stage
    StandardStatusbarItemsProvider.register("ui2-standardStatusItems", undefined, (stageId: string, _stageUsage: string, _applicationData: any) => {
      return stageId === "Ui2";
    });

    // Provides example widgets ui2.0 stage
    AppUi2StageItemsProvider.register(FrontstageUi2.showCornerButtons);
  }
}

export function MyCustomViewOverlay() {
  const [syncIdsOfInterest] = React.useState([SampleAppUiActionId.setTestProperty]);
  const [showOverlay, setShowOverlay] = React.useState(SampleAppIModelApp.getTestProperty() !== "HIDE");

  React.useEffect(() => {
    const handleSyncUiEvent = (args: SyncUiEventArgs) => {
      if (0 === syncIdsOfInterest.length)
        return;

      // istanbul ignore else
      if (syncIdsOfInterest.some((value: string): boolean => args.eventIds.has(value))) {
        const show = SampleAppIModelApp.getTestProperty() !== "HIDE";
        if (show !== showOverlay)
          setShowOverlay(show);
      }
    };

    // Note: that items with conditions have condition run when loaded into the items manager
    SyncUiEventDispatcher.onSyncUiEvent.addListener(handleSyncUiEvent);
    return () => {
      SyncUiEventDispatcher.onSyncUiEvent.removeListener(handleSyncUiEvent);
    };
  }, [setShowOverlay, showOverlay, syncIdsOfInterest]);

  return showOverlay ?
    <div className="uifw-view-overlay">
      <div className="my-custom-control" style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
      }}>
        <div>Hello World</div>
        <div>(turn off using Hide/Show items tool in horizontal toolbar at top-left)</div>
      </div>
    </div> : null;
}

```

Note `contentGroup` can reference a ContentGroup or a ContentGroupProvider See [Content Views and Layouts](./ContentViews.md) for more details.

### Usage

The Stage usage prop is a way to designate the type of tasks that will be performed in the stage and can be used by UiItemsProviders to
determine if it should supply items such as tool button, widgets, or status bar items, to populate the stage. See [StageUsage]($appui-abstract) for a default set of usages.

## Defining an 'empty' frontstage

It may be desirable for an application to set up an "empty" stage that is populated only by multiple [UiItemsProvider]($appui-abstract) instances. The

```tsx
    const ui2StageProps: StandardFrontstageProps = {
      id: "unique-stage-id",
      version: 1.1,
      contentGroupProps: myContentGroupProvider,
      hideNavigationAid,
      cornerButton,
      usage: StageUsage.General,
      applicationData,
    };

    ConfigurableUiManager.addFrontstageProvider(new StandardFrontstageProvider(ui2StageProps));

    // Use standard provider to provide basic tool and statusbar items
    StandardContentToolsProvider.register("ui2-standardContentTools");
    StandardNavigationToolsProvider.register("ui2-standardNavigationTools");
    StandardStatusbarItemsProvider.register("ui2-standardStatusbarItems");

```

## Configuring a Ninezone Frontstage (deprecated)

A frontstage is configured in a class subclassing the [FrontstageProvider]($appui-react) abstract class.
The FrontstageProvider contains an abstract [FrontstageProvider.frontstage]($appui-react) field containing a [Frontstage]($appui-react) React component.
The Frontstage React component has props for the default tool, Content Layout, Content Group, a Footer mode flag and application data.
It also has props for the Zones that are specified by their position in the 9-zone grid.

### Zone Descriptions

|Zone|Description
|-----|-----
|**topLeft** | contains the Tool Widget
|**topCenter** | contains the Tool Settings
|**topRight** | contains the Navigation Widget
|**centerLeft** | free zone for applications to use (App 1)
|**centerRight** | contains widgets for browsing; a Tree is typically used
|**bottomLeft** | free zone for applications to use (App 2)
|**bottomCenter** | reserved for the Status Bar, which shows messages and system state
|**bottomRight** | contains widgets showing Properties; A PropertyGrid is typically used

### Basic Sample

The following is a sample of a very basic FrontstageProvider definition with zones containing a Tool Widget, Tool Settings, Navigation Widget, Status Bar and Property Grid.

```tsx
export class SampleFrontstage extends FrontstageProvider {
    public static SampleContentGroup: ContentGroupProps = {
    id: "SampleFrontstageGroup",
    layout: StandardContentLayouts.singleView,
    contents: [
      {
        id: "primaryIModelView",
        classId: IModelViewportControl,
      },
    ],
  };

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const contentGroup = new ContentGroup(SampleFrontstage.SampleContentGroup);
    return (
      <Frontstage id="Test1"
        defaultTool={CoreTools.selectElementCommand}
        contentGroup={contentGroup}
        isInFooterMode={true}
        applicationData={{ key: "value" }}
        topLeft={
          <Zone
            widgets={[
              <Widget isFreeform={true} element={<SampleToolWidget />} />,
            ]}
          />
        }
        topCenter={
          <Zone
            widgets={[
              <Widget isToolSettings={true} />,
            ]}
          />
        }
        topRight={
          <Zone
            widgets={[
              <Widget isFreeform={true} element={<SampleNavigationWidget />} />,
            ]}
          />
        }
        bottomCenter={
          <Zone defaultState={ZoneState.Open}
            widgets={[
              <Widget isStatusBar={true} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.StatusBar"
                control={SampleAppStatusBarWidget} />,
            ]}
          />
        }
        bottomRight={
          <Zone defaultState={ZoneState.Open} allowsMerging={true}
            widgets={[
              <Widget defaultState={WidgetState.Open} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.PropertyGrid"
                control={SamplePropertyGridWidget} fillZone={true} />,
            ]}
          />
        }
      />
    );
  }
}

```

The `defaultTool` prop specifies a tool or command and `contentGroup` specifies a registered Content Group.
A `isInFooterMode` prop with a value of true indicates the Status Bar will be in Footer mode across the bottom of the screen.
A value of false would indicate the Status Bar is open in the bottom center position in the grid.
The `applicationData` prop specifies JSON data attached to the Frontstage and FrontstageDef.

Each zone prop specifies a **Zone** React component.
A Zone component can host one or more **Widget** React components, which are listed in the `widgets` prop.
The `defaultState` prop specifies the default zone state, which controls how the Zone is initially displayed. The default is ZoneState.Open.
The `allowsMerging` prop indicates if other zones may be merged with this zone. The default is false.
Zones can be merged together by default using the `mergeWithZone` prop, which indicates another zone to merge with.
The `applicationData` prop specifies JSON data attached to the Zone and ZoneDef.

## Setting a Frontstage active

```tsx
// Create a Frontstage.
const frontstageProvider = new SampleFrontstage();
// Add the provider to FrontstageManager
FrontstageManager.addFrontstageProvider(frontstageProvider);

// Set the Frontstage active
FrontstageManager.setActiveFrontstage(frontstageProvider.frontstage.props.id).then(() => {
  // Frontstage is ready
});
```

## Related Learning Topics

- [Content Views and Layouts](./ContentViews.md)
- [Widgets](./Widgets.md)
- [Status Bar and Fields](./StatusBar.md)
- [Tool Settings](./ToolSettings.md)
- [Stage Panels](./StagePanels.md)

## API Reference

- [Frontstage]($appui-react:Frontstage)
- [Zone]($appui-react:Zone)
