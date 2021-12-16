# UiItemsProvider

The [UiItemsProvider]($appui-abstract:UiItemsProvider) classes and interfaces are used for specifying UI items to be provided at runtime.
Items provided at runtime may be inserted into a Toolbar, StatusBar or Backstage. Widgets may also be provided at runtime.

## UiItemsProvider Interface

Below is an excerpt from the [UiItemsProvider]($appui-abstract) interface that shows the primary methods that an application or extension would want to implement to add items to different areas of the User Interface.

```ts
export interface UiItemsProvider {
  readonly id: string;
  provideToolbarButtonItems?: (stageId: string, stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation) => CommonToolbarItem[];
  provideStatusBarItems?: (stageId: string, stageUsage: string) => CommonStatusBarItem[];
  provideBackstageItems?: () => BackstageItem[];
  provideWidgets?: (stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection) => ReadonlyArray<AbstractWidgetProps>;
}
```

### UiItemsProvider Example

The code excerpt below is an example taken from `test-apps\ui-test-app` that shows a class that implements the UiItemsProvider interface.

```tsx
class TestUiProvider implements UiItemsProvider {
  public readonly id = "TestUiProvider";

  public provideToolbarButtonItems(_stageId: string, stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): CommonToolbarItem[] {

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

      const isHidden = new ConditionalBooleanValue(() => !SampleExtensionStateManager.isExtensionUiVisible, [SampleExtensionStateManager.SET_EXTENSION_UI_VISIBLE]);
      const statusBarItem = AbstractStatusBarItemUtilities.createLabelItem("PluginTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello", undefined, { isHidden });
      statusBarItems.push(statusBarItem);

      const labelCondition = new ConditionalStringValue(() => SampleExtensionStateManager.isExtensionUiVisible ? "Click to Hide" : "Click to Show", [SampleExtensionStateManager.SET_EXTENSION_UI_VISIBLE]);
      const iconCondition = new ConditionalStringValue(() => SampleExtensionStateManager.isExtensionUiVisible ? "icon-visibility-hide-2" : "icon-visibility", [SampleExtensionStateManager.SET_EXTENSION_UI_VISIBLE]);

      statusBarItems.push(
        AbstractStatusBarItemUtilities.createActionItem("PluginTest:StatusBarItem2", StatusBarSection.Center, 110, iconCondition, labelCondition,
          () => {
            SampleExtensionStateManager.isExtensionUiVisible = !SampleExtensionStateManager.isExtensionUiVisible;
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

The [UiItemsManager]($appui-abstract) class has a few responsibilities,

1. Used to register UiItemsProviders
2. Informs listeners that the list of registered UiItemsProviders has changed when a provider is registered or unregistered.
3. Provides a set of methods to retrieve item definitions from all registered UiItemProviders.

Below is an example of registering the TestUiProvider defined above.

```ts
UiItemsManager.register( new TestUiProvider());
```

### Examples

The following examples show how an application can allow, disallow and update a Toolbar item.

#### Allowing a Toolbar Item

```ts
class ExampleUiItemsApplication implements UiItemsApplication {
  public validateToolbarButtonItem(item: CommonToolbarItem): { updatedItem: CommonToolbarItem, action: UiItemsApplicationAction } {
    return { updatedItem: item, action: UiItemsApplicationAction.Allow };
  }
}
```

#### Disallowing a Toolbar Item

```ts
class ExampleUiItemsApplication implements UiItemsApplication {
  public validateToolbarButtonItem(item: CommonToolbarItem): { updatedItem: CommonToolbarItem, action: UiItemsApplicationAction } {
    let action = UiItemsApplicationAction.Allow;
    if (item.id === "test2")
      action = UiItemsApplicationAction.Disallow;
    return { updatedItem: item, action };
  }
}
```

#### Updating a Toolbar Item

```ts
class ExampleUiItemsApplication implements UiItemsApplication {
  public validateToolbarButtonItem(item: CommonToolbarItem): { updatedItem: CommonToolbarItem, action: UiItemsApplicationAction } {
    let action = UiItemsApplicationAction.Allow;
    let updatedItem = item;
    if (item.id === "test2") {
      action = UiItemsApplicationAction.Update;
      updatedItem = { ...item, itemPriority: 1000 };
    }
    return { updatedItem, action };
  }
}
```

## API Reference

- [UiItemsProvider]($appui-abstract:UiItemsProvider)
