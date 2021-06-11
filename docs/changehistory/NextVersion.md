---
publish: false
---
# NextVersion

## UI Changes

Added ability for UiItemsProvider to provide widgets to "zone" locations when running is AppUi version 1. Prior to this a widget could only be targeted to a "stage panel" location.

### Example UiItemsProvider

The example below, shows how to add a widget to a StagePanelLocation if UiFramework.uiVersion === "2" and to the "BottomRight" zone location if UiFramework.uiVersion === "1".  See [UiItemsProvider.provideWidgets]($ui-abstract) for new `zoneLocation` argument.

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
