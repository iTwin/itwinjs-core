---
publish: false
---
# NextVersion

## UI Changes

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

## External Textures

API is now provided to wait for all pending external textures to finish loading. A method titled `waitForAllExternalTextures` has been added to [RenderSystem]($frontend). This method returns a promise which when resolved indicates that all pending external textures have finished loading from the backend.

Example:

```ts
await IModelApp.renderSystem.waitForAllExternalTextures(); // this will wait for all pending external textures to finish loading.
```
