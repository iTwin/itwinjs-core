# StatusBar

The [StatusBar]($ui-abstract:StatusBar) classes and interfaces are used for creating and managing items in the Status Bar/Footer.

## Abstract StatusBar Item Utilities

[AbstractStatusBarItemUtilities]($ui-abstract) is a utility class for creating abstract StatusBar items definitions.

The following example defines a StatusBar item that executes an action when pressed. In this simple example it just write a message to the console.

```ts
AbstractStatusBarItemUtilities.createActionItem("Sample:StatusBarItem1", StatusBarSection.Center, 100, "icon-developer", "Test tool-tip",
  () => {
    console.log("Got Here!");
  }));
```

The following example defines a StatusBar item that just displays an icon and a label. The label is defined using a [ConditionalStringValue] and will update when the SyncUi Event Id defined, by the string "SampleApp.SET_EXTENSION_UI_VISIBLE", is fired by the application or extension. There is additional information about SyncUi at [SyncUi]($ui-framework:SyncUi).

```ts
const labelCondition = new ConditionalStringValue(() => SampleExtensionStateManager.isExtensionUiVisible ? "Active" : "Inactive", ["SampleApp.SET_EXTENSION_UI_VISIBLE"]);
AbstractStatusBarItemUtilities.createLabelItem("Sample:StatusBarLabel1", StatusBarSection.Center, 200, "icon-hand-2", labelCondition, undefined);
```

See [StatusBarItemUtilities]($ui-framework) for React specific StatusBar item definitions.

## API Reference

- [StatusBar]($ui-abstract:StatusBar)
