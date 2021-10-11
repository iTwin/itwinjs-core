# Nested Frontstages

A [NestedFrontstage]($appui-react) is accessed from a primary [Frontstage](./Frontstages.md). It may use all zones and panels, but instead of the App button, the Tool Widget contains a Back button to return to the primary Frontstage.

## Definition of Nested Frontstage

The definition of a nested frontstage is no different from a primary frontstage with one exception:
the `appButton` prop of the ToolWidget component specifies `{NestedFrontstage.backToPreviousFrontstageCommand}`,
which will return to the previous frontstage when clicked/pressed.

```tsx
<ToolWidget
  appButton={NestedFrontstage.backToPreviousFrontstageCommand}
  horizontalToolbar={this._horizontalToolbar}
  verticalToolbar={this._verticalToolbar}
/>
```

## Code to Open Nested Frontstage

The following code that instantiates a nested frontstage, initializes the [FrontstageDef]($appui-react), and calls [FrontstageManager.openNestedFrontstage]($appui-react) to open the nested frontstage.

```ts
const frontstageProvider = new NestedFrontstage();
const frontstageDef = await FrontstageDef.create(frontstageProvider);
await FrontstageManager.openNestedFrontstage(frontstageDef);
```
