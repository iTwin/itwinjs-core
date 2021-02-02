# Frontstages

A **Frontstage** is a full-screen configuration designed to enable the user to accomplish a task. There are three types of frontstages:

|Type|Description
|-----|-----
|**Primary** | may use all zones and stage panels and the Tool Widget contains the App button that opens the App menu
|**Nested** | is accessed from a primary frontstage. It may use all zones and panels, but instead of the App button, the Tool Widget contains a Back button to return to the primary frontstage.
|**Modal** | is accessed from another frontstage or the Backstage. It may contain any content along with a Back button. It does not use zones or stage panels. It is useful for application settings and data management user interfaces.

## Configuring a Frontstage

A frontstage is configured in a class subclassing the [FrontstageProvider]($ui-framework) abstract class.
The FrontstageProvider contains an abstract [FrontstageProvider.frontstage]($ui-framework) field containing a [Frontstage]($ui-framework) React component.
The Frontstage React component has props for the default tool, Content Layout, Content Group, a Footer mode flag and application data.
It also has props for the Zones that are specified by their position in the 9-zone grid.

### Zone Descriptions

The following zone props are used in the Frontstage React component.

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

  public get frontstage(): React.ReactElement<FrontstageProps> {
    return (
      <Frontstage id="Test1"
        defaultTool={CoreTools.selectElementCommand}
        defaultLayout="TwoHalvesVertical"
        contentGroup="TestContentGroup1"
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

The `defaultTool` prop specifies a tool or command.
`defaultLayout` specifies a registered Content Layout and `contentGroup` specifies a registered Content Group.
Note that these two props can reference a ContentLayoutDef and ContentGroup directly instead of specifying an Id.
See [Content Views and Layouts](./ContentViews.md) for more details.
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
FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef).then(() => {
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

- [Zone]($ui-framework:Zone)
