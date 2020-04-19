# Backstage

The [Backstage]($ui-framework:Backstage) is a menu used to open frontstages and launch tasks and commands.
It can also open full-screen overlays presenting application settings and data management to the user.
These overlays are an implementation of a modal frontstage.
The backstage is opened by clicking or pressing the App button and displays along the left edge of the window.

## Specifying a Backstage to ConfigurableUiContent

```tsx

interface AppConfigurableUiContentProps {
  accessToken: AccessToken | undefined;
  readonly backstageItems: BackstageItem[];
}

const AppConfigurableUiContent: React.FC<AppConfigurableUiContentProps> = (props) => {
  const {backstageItems, accessToken} = props;
  const appBackstage: <BackstageComposer items={backstageItems} header={accessToken && <UserProfileBackstageItem accessToken={accessToken} />,
  return (
    <ConfigurableUiContent {...configurableUiContentProps} />
    );
  }
}
```

### Example Defining Backstage Items

The following excerpt shows an example of defining the contents of an application's backstage menu. See [BackstageItemUtilities]($ui-abstract) for the methods used to define the menu's contents.  The items created below would be passed as props to the [BackstageComposer]($ui-framework).

```ts
  private _backstageItems: BackstageItem[] | undefined = undefined;

  public get backstageItems(): BackstageItem[] {
    if (!this._backstageItems) {
      this._backstageItems = [
        BackstageItemUtilities.createStageLauncher("IModelIndex", 200, 20, IModelApp.i18n.translate("SampleApp:backstage.imodelindex"), undefined, "icon-placeholder"),
        BackstageItemUtilities.createActionItem("SampleApp.settings", 300, 10, () => FrontstageManager.openModalFrontstage(new SettingsModalFrontstage()), IModelApp.i18n.translate("SampleApp:backstage.testFrontstage6"), undefined, "icon-placeholder"),
        BackstageItemUtilities.createStageLauncher("ViewsFrontstage", 400, 10, IModelApp.i18n.translate("SampleApp:backstage.viewIModel"), IModelApp.i18n.translate("SampleApp:backstage.iModelStage"), "icon-placeholder"),
      ];
    }
    return this._backstageItems;
  }

```
