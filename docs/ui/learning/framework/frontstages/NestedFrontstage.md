# Nested Frontstages

A **Nested Frontstage** is accessed from a primary frontstage. It may use all zones and panels, but instead of the App button, the Tool Widget contains a Back button to return to the primary frontstage.

## Definition of Nested Frontstage

The definition of a nested frontstage is no different from a primary frontstage with one exception:
the `appButton` prop of the ToolWidget component specifies `{NestedFrontstage.backToPreviousFrontstageCommand}`,
which will return to the previous frontstage when clicked/pressed.

```TSX
      <ToolWidget
        appButton={NestedFrontstage.backToPreviousFrontstageCommand}
        horizontalToolbar={this._horizontalToolbar}
        verticalToolbar={this._verticalToolbar}
      />
```

## Code to Open Nested Frontstage

The following code that instantiates a nested frontstage,
initializes the FrontstageDef, and calls `FrontstageManager.openNestedFrontstage` to open the nested frontstage.

```TS
      const frontstageProvider = new NestedFrontstage1();
      const frontstageDef = frontstageProvider.initializeDef();
      await FrontstageManager.openNestedFrontstage(frontstageDef);
```

## API Reference

* [NestedFrontstage]($framework)
* [FrontstageManager]($framework)
* [Frontstage]($framework:Frontstage)
