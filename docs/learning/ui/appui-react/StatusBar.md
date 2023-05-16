# Status Bar

The **Status Bar** gives the user feedback about the state of an application.
A **Status Field** is an area of the Status Bar assigned to display specific feedback about the active application.
The Status Bar contains one or more Status Fields.

## Defining a Status Bar Widget

The Status Bar is defined by a class derived from StatusBarWidgetControl. This class must implement the method getReactNode to return a [StatusBarComposer]($appui-react) control containing all status fields. Below is an example of populating the StatusBarComposer.

```tsx
export class AppStatusBarWidgetControl extends StatusBarWidgetControl {
  private _statusBarItems: StatusBarItem[] | undefined;

  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);
  }

  public get statusBarItems(): StatusBarItem[] {
    if (!this._statusBarItems) {
      const snapCondition = { testFunc: () => SampleAppIModelApp.getTestProperty() !== "HIDE", syncEventIds: [SampleAppUiActionId.setTestProperty], type: ConditionalDisplayType.Visibility };

      this._statusBarItems = [
        StatusBarItemUtilities.createStatusBarItem("ToolAssistance", StatusBarSection.Left, 10, <ToolAssistance />),
        StatusBarItemUtilities.createStatusBarItem("ToolAssistanceSeparator", StatusBarSection.Left, 15, (<FooterMode> <StatusBarSeparator /> </FooterMode>)),
        StatusBarItemUtilities.createStatusBarItem("MessageCenter", StatusBarSection.Left, 20, <MessageCenter />),
        StatusBarItemUtilities.createStatusBarItem("MessageCenterSeparator", StatusBarSection.Left, 25, (<FooterMode> <StatusBarSeparator /> </FooterMode>)),
        StatusBarItemUtilities.createStatusBarItem("DisplayStyle", StatusBarSection.Center, 40, <DisplayStyle />),
        StatusBarItemUtilities.createStatusBarItem("ActivityCenter", StatusBarSection.Center, 10, <ActivityCenter />),
        StatusBarItemUtilities.createStatusBarItem("ViewAttributes", StatusBarSection.Center, 60, <ViewAttributes />),
        StatusBarItemUtilities.createStatusBarItem("Sections", StatusBarSection.Center, 50, <Sections hideWhenUnused={true} />),
        StatusBarItemUtilities.createStatusBarItem("ClearEmphasis", StatusBarSection.Center, 40, <ClearEmphasis hideWhenUnused={true} />),
        StatusBarItemUtilities.createStatusBarItem("SnapMode", StatusBarSection.Center, 30, <SnapMode />, { condition: snapCondition }),
        StatusBarItemUtilities.createStatusBarItem("TileLoadIndicator", StatusBarSection.Right, 10, <TileLoadIndicator />),
        StatusBarItemUtilities.createStatusBarItem("SelectionInfo", StatusBarSection.Right, 30, <SelectionInfo />),
        StatusBarItemUtilities.createStatusBarItem("SelectionScope", StatusBarSection.Right, 20, <SelectionScope />),
      ];
    }
    return this._statusBarItems;
  }

  public getReactNode(_args: StatusBarWidgetControlArgs): React.ReactNode {
    return (
      <StatusBarComposer items={this.statusBarItems} />
    );
  }
}

ConfigurableUiManager.registerControl("AppStatusBar", AppStatusBarWidgetControl);

```

The [StatusBar]($appui-react:StatusBar) classes and interfaces are used for creating and managing items in the Status Bar/Footer.

## StatusBar Item Utilities

[StatusBarItemUtilities]($appui-react) is a utility class for creating StatusBar items definitions.

The following example defines a StatusBar item that executes an action when pressed. In this simple example it just write a message to the console.

```ts
StatusBarItemUtilities.createActionItem("Sample:StatusBarItem1", StatusBarSection.Center, 100, "icon-developer", "Test tool-tip",
  () => {
    console.log("Got Here!");
  }));
```

The following example defines a StatusBar item that just displays an icon and a label. The label is defined using a [ConditionalStringValue] and will update when the SyncUi Event Id defined, by the string "SampleApp.SET_EXTENSION_UI_VISIBLE", is fired by the application or extension. There is additional information about SyncUi at [SyncUi]($appui-react:SyncUi).

```ts
const labelCondition = new ConditionalStringValue(() => SampleExtensionStateManager.isExtensionUiVisible ? "Active" : "Inactive", ["SampleApp.SET_EXTENSION_UI_VISIBLE"]);
StatusBarItemUtilities.createLabelItem("Sample:StatusBarLabel1", StatusBarSection.Center, 200, "icon-hand-2", labelCondition, undefined);
```

See [StatusBarItemUtilities]($appui-react) for React specific StatusBar item definitions.

## API Reference

- [StatusBar]($appui-react:StatusBar)
