# Settings

The [SettingsManager]($core-react) allows the registration of [SettingsTabsProvider]($core-react) classes to provide the settings to display with the [SettingsContainer]($core-react) component. In an application that employs App UI, the [SettingsModalFrontstage]($appui-react) frontstage will display the SettingsContainer and its entries.

## SettingsTabEntry

Registered [SettingsTabsProvider]($core-react) instance will implement the method `getSettingEntries` to return an array of [SettingsTabsProvider]($core-react) items. Each SettingsTabEntry will populate a Tab entry in the [SettingsContainer]($core-react) component. The `tabId` property is a string and must be unique across all registered SettingsProviders. A common practice is to prefix the tabId with the package name to ensure uniqueness. The `page` property holds the React.Element that will be used to construct the component to edit settings for this entry.  It is the `page's` responsibility to persist and retrieve persisted settings. If the `page` contains multiple properties that must be saved together the SettingsTabEntry can set the `pageWillHandleCloseRequest` property to `true`. The `page's` control should then register to be notified when the setting container is closing or when the active SettingsEnty is changing so that any unsaved data can be saved. Two React hooks are provided to assist: `settingsManager.onProcessSettingsTabActivation` and `settingsManager.onProcessSettingsContainerClose`.

## Example

### Example SettingsTabsProvider

Example below shows a settings provide that provides two settings pages. The first one depicts a page that has properties that cannot be saved immediately as individual properties are changed. It must be treated as a modal where once all values are define a save button is used the save the changes.  The second settings page handles settings that can be immediately saved when changed and does not require any special processing when the page is closed.

```tsx
// Sample UI items provider that dynamically adds ui items
export class ExampleSettingsProvider implements SettingsTabsProvider {
  public readonly id = "myApp:ExampleSettingsProvider";

  public getSettingEntries(stageId: string, stageUsage: string): ReadonlyArray<SettingsTabEntry> | undefined {
    // It is possible to use arguments stageId and stageUsage to determine if a settings entry is to be provided for display. In this example
    // we will just assume to always provide this SettingsTabEntry.
    return [
      {
        itemPriority: 60,
        tabId: "myApp:ExampleModalSettingsPage",
        label:"Modal Feature",
        page: <ExampleModalSettingsPage />,
        icon: "icon-paintbrush",
        tooltip: "My Example Modal Feature Settings",
        pageWillHandleCloseRequest: true,
      },
      {
        itemPriority: 70,
        tabId: "myApp:ExampleSimpleSettingsPage",
        label:"Simple Feature",
        page: <ExampleSimpleSettingsPage />,
        tooltip: "My Example Simple Feature Settings",
      },
    ];
  }

  public static initializeAppSettingProvider() {
    // Assuming running in App UI based application the SettingsManager instance is available via UiFramework.settingsManager
    UiFramework.settingsManager.addSettingsProvider(new AppSettingsProvider());
  }
}
```

### Example Page Definition

Below is an example of a settings page component that has `pageWillHandleCloseRequest` set to true so it can save its data before unmounting. When setting `pageWillHandleCloseRequest` it is the page component's responsibility to call the `afterSaveFunction` to allow the processing that prompted the settings to be saved to continue.

```tsx
export function ExampleModalSettingsPage() {
  const [mySettingsData, setMySettingsData] = React.useState(getInitialSettingsData());
  const [saveEnabled, setSaveEnabled] = React.useState(false);

  const persistMyChanges = React.useCallback((newSettings: any) => {
    // do the work to persist here
    console.log (`Data Persisted`);
  }, []);

  // callback passed to hooks to prompt user to save data before unmounting. This technique allows use to ignore the request sent to close the page.
  const saveChanges = React.useCallback((afterSaveFunction: (args: any) => void, args?: any) => {
    if (saveEnabled) {
      ModalDialogManager.openDialog(<SaveFormatModalDialog persistChangesFunc={persistMyChanges} persistChangesFuncArg={mySettingsData}
      onDialogCloseArgs={args} onDialogClose={afterSaveFunction} />);
      return;
    }
    afterSaveFunction(args);
  }, [saveEnabled, persistMyChanges, persistChangesFuncArg]);

  // use provided hooks to allow saving before this page is unloaded
  useSaveBeforeActivatingNewSettingsTab(UiFramework.settingsManager, saveChanges);
  useSaveBeforeClosingSettingsContainer(UiFramework.settingsManager, saveChanges);

  const handleSaveChange = React.useCallback((newSettings: any) => {
    persistMyChanges(newSettings);
    setSaveEnabled(false);
  }, []);

  const handleValueChange = React.useCallback((newSettings: any) => {
    setMySettingsData(new);
    setSaveEnabled(true);
  }, []);

  return (
    <div>
      <MyDataPanel onValueChange={handleValueChange} value={mySettingsData} />
      <div className="components-button-panel">
        <Button buttonType={ButtonType.Blue} onClick={handleSaveChange} disabled={!saveEnabled}>Save</Button>
      </div>
    </div>
  );
}

function SaveFormatModalDialog({ persistChangesFunc, persistChangesFuncArg, onDialogCloseArgs, onDialogClose }:
  { persistChangesFunc, persistChangesFuncArg, onDialogCloseArgs?: any, onDialogClose: (args?: any) => void }) {
  const [isOpen, setIsOpen] = React.useState(true);

  const handleClose = React.useCallback(() => {
    setIsOpen(false);
    ModalDialogManager.closeDialog();
    if (onDialogClose)
      onDialogClose(onDialogCloseArgs);
  }, [onDialogClose, onDialogCloseArgs]);

  const handleOK = React.useCallback(() => {
    persistChangesFunc(persistChangesFuncArg)
    handleClose();
  }, [handleClose, persistChangesFunc, persistChangesFuncArg]);

  const handleCancel = React.useCallback(() => {
    handleClose();
  }, [handleClose]);

  return (
    <Dialog
      title={"Save Changes"}
      opened={isOpen}
      resizable={false}
      movable={false}
      modal={true}
      buttonCluster={[
        { type: DialogButtonType.Yes, onClick: handleOK },
        { type: DialogButtonType.No, onClick: handleCancel },
      ]}
      onEscape={handleCancel}
      onClose={handleCancel}
      onOutsideClick={handleCancel}
      minHeight={150}
      maxHeight={400}
      maxWidth={400}
      minWidth={200}
    >
      <div className="modal-dialog2">
        Do you want to save changes?
      </div>
    </Dialog >
  );
}
```

## API Reference

- [SettingsManager]($core-react)
- [SettingsTabsProvider]($core-react)
- [SettingsContainer]($core-react)
- [SettingsTabEntry]($core-react)
