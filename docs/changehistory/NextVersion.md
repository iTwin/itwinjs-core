---
publish: false
---
# NextVersion

## Scientific visualization

The [AnalysisStyle]($common) APIs have been cleaned up and promoted to `@public`. An AnalysisStyle is used to animate a mesh that has been supplemented with [PolyfaceAuxData]($geometry-core), by recoloring and/or deforming its vertices over time. This enables visualization of the effects of computed, changing variables like stress and temperature.

## UI changes

### @bentley/ui-abstract package

Added ability for [UiItemsProvider]($ui-abstract) to provide widgets to [AbstractZoneLocation]($ui-abstract) locations when running is AppUi version 1. Prior to this a widget could only be targeted to a [StagePanelLocation]($ui-abstract) location.

#### Example UiItemsProvider

The example below, shows how to add a widget to a [StagePanelLocation]($ui-abstract) if UiFramework.uiVersion === "2" and to the "BottomRight" [AbstractZoneLocation]($ui-abstract) if UiFramework.uiVersion === "1".  See [UiItemsProvider.provideWidgets]($ui-abstract) for new `zoneLocation` argument.

```tsx
export class ExtensionUiItemsProvider implements UiItemsProvider {
  public readonly id = "ExtensionUiItemsProvider";
  public static i18n: I18N;
  private _backstageItems?: BackstageItem[];

  public constructor(i18n: I18N) {
    ExtensionUiItemsProvider.i18n = i18n;
  }

  /** provideWidgets() is called for each registered UI provider to allow the provider to add widgets to a specific section of a stage panel.
   *  items to the StatusBar.
   */
  public provideWidgets(_stageId: string, stageUsage: string, location: StagePanelLocation, section: StagePanelSection | undefined, zoneLocation?: AbstractZoneLocation): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    // section will be undefined if uiVersion === "1" and in that case we can add widgets to the specified zoneLocation
    if ((undefined === section && stageUsage === StageUsage.General && zoneLocation === AbstractZoneLocation.BottomRight) ||
      (stageUsage === StageUsage.General && location === StagePanelLocation.Right && section === StagePanelSection.End && "1" !== UiFramework.uiVersion)) {
      {
        widgets.push({
          id: PresentationPropertyGridWidgetControl.id,
          icon: PresentationPropertyGridWidgetControl.iconSpec,  // icon required if uiVersion === "1"
          label: PresentationPropertyGridWidgetControl.label,
          defaultState: WidgetState.Open,
          getWidgetContent: () => <PresentationPropertyGridWidget />, // eslint-disable-line react/display-name
          canPopout: true,  // canPopout ignore if uiVersion === "1"
        });
      }
    }
    return widgets;
  }
}
```

### @bentley/ui-framework package

- The need for an IModelApp to explicitly call [ConfigurableUiManager.initialize]($ui-framework) has been removed. This call is now made when processing [UiFramework.initialize]($ui-framework). This will not break any existing applications as subsequent calls to `ConfigurableUiManager.initialize()` are ignored.

- If an application calls [UiFramework.setIModelConnection]($ui-framework) it will no longer need to explicitly call [SyncUiEventDispatcher.initializeConnectionEvents]($ui-framework) as `UiFramework.setIModelConnection` will call that method as it update the redux store.

- The `version` prop passed to [FrameworkVersion]($ui-framework) component will update the [UiFramework.uiVersion] if necessary keeping the redux state matching the value defined by the prop.

- The [ScheduleAnimationTimelineDataProvider]($ui-framework) is published for use by AppUi apps. Specifying this data provider to a [TimelineComponent]($ui-components) allows animation of the [RenderSchedule.Script]($common) if one exists for the view. A component that automatically detects a schedule script and attaches the data provider to its TimelineComponent can be found in the [DefaultViewOverlay]($ui-framework).

- The [AnalysisAnimationTimelineDataProvider]($ui-framework) is published for use by AppUi apps. Specifying this data provider to a TimelineComponent allows animation of the information in the AnalysisDisplayProperties if the view's [DisplayStyleState]($frontend) contains one. A component that automatically detects analysis data and attaches the data provider to its TimelineComponent can be found in the [DefaultViewOverlay]($ui-framework).

### @bentley/ui-componentsframework package

- Added component [QuantityNumberInput]($ui-components) which accepts input for quantity values. The quantity value is shown as a single numeric value and the quantity "display" unit is shown next to the input control. The "display" unit is determined by the active unit system as defined by the [QuantityFormatter]($frontend). The control also provides buttons to increment and decrement the "displayed" value. The value reported by via the onChange function is in "persistence" units that can be stored in the iModel.

### Quantity package

The Format class now provides the method [Format.clone]($quantity) to clone an existing Format. [CloneOptions]($quantity) may be optionally passed into the clone method to adjust the format.
