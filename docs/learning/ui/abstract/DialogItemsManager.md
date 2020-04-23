# DialogItemsManager

The [DialogItemsManager]($ui-abstract:Dialog) uses [DialogItem]($ui-abstract:Dialog) specifications to create UI components in our AppUI system by organizing the DialogItem specifications into a data structure that can be easily turned into a Grid layout. It also provides a property changed callback function for app to react to changes in the UI.

Currently, the ui-framework component DefaultDialogGridContainer its associated ComponentGenerator with the output from DialogItemsManager to generate a grid display of React components.

A DialogItemsManager class is created with:

```ts
new DialogItemsManager(items?: ReadonlyArray<DialogItem>);
```
If the array of dialog items may be specified or changed later with the items accessor:

```ts
itemsManager = new DialogItemsManager();
itemsManager.items = dialogItems;
```

The DialogItemsManager also provides the app with a callback to receive information about changes in the app UI. The applyPropertyChanged() method has this signature:

```ts
public applyUiPropertyChange = (_item: DialogPropertySyncItem): void
```

To handle UI changes in your app, simply set up your own method to override the default method in DialogItemsManager:

```ts
    this._itemsManager = new DialogItemsManager();
    this._itemsManager.applyUiPropertyChange = this.applyUiPropertyChange;
```

The applyUIPropertyChange should set any app variables controlled by the UI component that has changed. Here's an example from the dialogItemsSample extension:

```ts
  public applyUiPropertyChange = (updatedValue: DialogPropertySyncItem): void => {
    this.option = updatedValue.value.value;
  }
```

## API Reference

* [DialogItemsManager]($ui-abstract:Dialog)
