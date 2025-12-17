---
publish: false
---
# NextVersion

- [NextVersion](#nextversion)
  - [BENTLEY_materials_point_style](#bentley_materials_point_style)
  - [ChangeElementModel Backend API](#changeelementmodel-api)

## Display

### BENTLEY_materials_point_style

Support has been added for the proposed [BENTLEY_materials_point_style](https://github.com/CesiumGS/glTF/pull/91) glTF extension.

This allows iTwin.js to process and apply the above extension when loading glTF files. This means point primitives will be able to have a diameter property specified and respected in iTwin.js when loaded via glTF.

The image below demonstrates four points with different diameters and colors being rendered in iTwin.js using this glTF extension.

![A rendering of four points with varying colors and widths as specified via BENTLEY_materials_point_style](.\assets\BENTLEY_materials_point_style.jpg)

## Backend

### ChangeElementModel API

A new API [IModelDb.Elements.changeElementModel]($backend) allows moving an element to a different model.

**Key Features:**

- **Bulk Operation**: If the element has child elements, the entire element hierarchy is moved to the target model.
- **Lifecycle Hooks**: The [Model]($backend) class now includes two lifecycle hooks: `onElementModelChange` and `onElementModelChanged`.
- **Optional Callback**: Accepts a callback for performing fix-ups after the model change, such as updating the code scope.
- **Atomic Operation**: If any error occurs, the entire operation is rolled back leaving the iModel in a consistent state.

**Example Usage:**

```ts
imodel.elements.changeElementModel(elementId, targetModelId, (elementProps, targetModelId, iModelDb) => {
  // Update the code scope to match the new model
  if (elementProps.code && elementProps.code.value) {
    elementProps.code.scope = targetModelId;
    // Update the element with the modified code
    iModelDb.elements.updateElement(elementProps);
  }
  // Other fix-ups can be performed here
});
```

**Callback Parameters:**

- `elementProps` - The element properties before the model change
- `targetModelId` - The ID of the target model
- `iModelDb` - The IModelDb instance
