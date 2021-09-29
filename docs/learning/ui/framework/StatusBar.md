# Status Bar

The **Status Bar** is the Widget that gives the user feedback about the state of an application.
A **Status Field** is an area of the Status Bar assigned to display specific feedback about the active application.
The Status Bar contains one or more Status Fields.

## Defining a Status Bar Widget

The Status Bar is defined by a class derived from StatusBarWidgetControl. This class must implement the method getReactNode to return the ReactNode that is the container control for all status bar items (also referred to as status fields). This container control should be the [StatusBarComposer]($appui-react) control.  Below is an example of populating the StatusBarComposer.

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
        StatusBarItemUtilities.createStatusBarItem("ToolAssistanceSeparator", StatusBarSection.Left, 15, (<FooterMode> <FooterSeparator /> </FooterMode>)),
        StatusBarItemUtilities.createStatusBarItem("MessageCenter", StatusBarSection.Left, 20, <MessageCenter />),
        StatusBarItemUtilities.createStatusBarItem("MessageCenterSeparator", StatusBarSection.Left, 25, (<FooterMode> <FooterSeparator /> </FooterMode>)),
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

## API Reference

- [StatusBar]($appui-react:StatusBar)
