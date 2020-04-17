# UiItemsProvider

The [UiItemsProvider]($ui-abstract:UiItemsProvider) classes and interfaces are used for specifying UI items to be provided at runtime.
Items provided at runtime may be inserted into a Toolbar, StatusBar or Backstage. Widgets may also be provided at runtime.

## UiItemsProvider Interface

Below is an excerpt from the UiItemsProvider interface that shows the primary methods that an application or extension would want to implement to add items to different areas of the User Interface.

```ts
export interface UiItemsProvider {
  readonly id: string;
  provideToolbarButtonItems?: (stageId: string, stageUsage: StageUsage, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation) => CommonToolbarItem[];
  provideStatusBarItems?: (stageId: string, stageUsage: StageUsage) => CommonStatusBarItem[];
  provideBackstageItems?: () => BackstageItem[];
  provideWidgets?: (stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection) => ReadonlyArray<AbstractWidgetProps>;
}
```

### UiItemsProvider Example

The code excerpt below is an example taken from `imodeljs\test-apps\ui-test-app` that shows a class that implements the UiItemsProvider interface.

```tsx
class TestUiProvider implements UiItemsProvider {
  public readonly id = "TestUiProvider";

  public provideToolbarButtonItems(_stageId: string, stageUsage: StageUsage, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): CommonToolbarItem[] {

    if (stageUsage === StageUsage.General && toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Horizontal) {
      const simpleActionSpec = ToolbarItemUtilities.createActionButton("simple-test-action-tool", 200, "icon-developer", "simple-test-action-tool",
        (): void => {
          console.log("Got Here!");
        });

      const isHiddenCondition = new ConditionalBooleanValue((): boolean => SampleAppIModelApp.getTestProperty() === "HIDE", [SampleAppUiActionId.setTestProperty]);
      const childActionSpec = ToolbarItemUtilities.createActionButton("child-test-action-tool", 210, "icon-developer", "child-test-action-tool",
        (): void => {
          console.log("Got Here!");
        }, { isHidden: isHiddenCondition });

      const nestedActionSpec = ToolbarItemUtilities.createActionButton("nested-test-action-tool", 220, "icon-developer", "test action tool (nested)",
        (): void => {
          console.log("Got Here!");
        });
      const groupSpec = ToolbarItemUtilities.createGroupButton("test-tool-group", 230, "icon-developer", "test group", [childActionSpec, simpleActionSpec], { badgeType: BadgeType.TechnicalPreview, parentToolGroupId: "tool-formatting-setting" });

      return [simpleActionSpec, nestedActionSpec, groupSpec];
    }
    return [];
  }

  public provideStatusBarItems(_stageId: string, stageUsage: string): CommonStatusBarItem[] {
    const statusBarItems: CommonStatusBarItem[] = [];
    const ShadowToggle = withStatusFieldProps(ShadowField);

    if (stageUsage === StageUsage.General) {
      statusBarItems.push(
        AbstractStatusBarItemUtilities.createActionItem("PluginTest:StatusBarItem1", StatusBarSection.Center, 100, "icon-developer", "test status bar from plugin",
          () => {
            console.log("Got Here!");
          }));

      const isHidden = new ConditionalBooleanValue(() => !SamplePluginStateManager.isPluginUiVisible, [SamplePluginStateManager.SET_PLUGIN_UI_VISIBLE]);
      const statusBarItem = AbstractStatusBarItemUtilities.createLabelItem("PluginTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello", undefined, { isHidden });
      statusBarItems.push(statusBarItem);

      const labelCondition = new ConditionalStringValue(() => SamplePluginStateManager.isPluginUiVisible ? "Click to Hide" : "Click to Show", [SamplePluginStateManager.SET_PLUGIN_UI_VISIBLE]);
      const iconCondition = new ConditionalStringValue(() => SamplePluginStateManager.isPluginUiVisible ? "icon-visibility-hide-2" : "icon-visibility", [SamplePluginStateManager.SET_PLUGIN_UI_VISIBLE]);

      statusBarItems.push(
        AbstractStatusBarItemUtilities.createActionItem("PluginTest:StatusBarItem2", StatusBarSection.Center, 110, iconCondition, labelCondition,
          () => {
            SamplePluginStateManager.isPluginUiVisible = !SamplePluginStateManager.isPluginUiVisible;
          }));

      // add entry that supplies react component
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("ShadowToggle", StatusBarSection.Right, 5, <ShadowToggle />));
    }
    return statusBarItems;
  }

  public provideWidgets(stageId: string, _stageUsage: string, location: StagePanelLocation, _section?: StagePanelSection | undefined): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    if (stageId === "ViewsFrontstage" && location === StagePanelLocation.Right) {
      widgets.push({
        id: "addonWidget",
        getWidgetContent: () => <FillCentered>Addon Widget in panel</FillCentered>,
      });
    }
    return widgets;
  }
}
```

## UiItemsManager Class

The [UiItemsManager]($ui-abstract) class is used to registered UiItemsProviders. It also informs listeners that the list of registered UiItemsProviders has changed when a provider is registered or unregistered. This class also provides methods to retrieve item definitions from all registered UiItemProviders.

Below is an example of registering the TestUiProvider defined above.

```ts
      UiItemsManager.register( new TestUiProvider());
```

## UiItemsArbiter Class

## UiItemsApplication Interface

## API Reference

* [UiItemsProvider]($ui-abstract:UiItemsProvider)
