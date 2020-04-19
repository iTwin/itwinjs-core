# PropertyEditors

The [PropertyEditors]($ui-components:PropertyEditors) category in the `@bentley/ui-components` package includes
classes and components for working with Property Editors.
Property editors are used by the Table, Tree and PropertyGrid components for cell editing of properties.
Property editors have two pieces:

1. A class that extends [PropertyEditorBase]($ui-components), is registered for a certain type name and optionally an editor name, and returns a React node for the editor component
1. A React component that implements [TypeEditor]($ui-components) and renders the editor and processes user interaction

Each property editor must be registered with the [PropertyEditorManager]($ui-components)
for a given type name, and optionally an editor name,
by calling the `registerEditor` method.

```ts
PropertyEditorManager.registerEditor("text", BasicPropertyEditor);
```

The [EditorContainer]($ui-components) component is used by the Table, Tree and PropertyGrid for cell editing.
Those components render an EditorContainer in a cell when cell editing is invoked. The EditorContainer
creates the appropriate property editor based on the cell's [PropertyDescription]($ui-abstract),
which contains the type name and optional editor name.

The following is a list of the provided property editors:

* [BasicPropertyEditor]($ui-components) - registered for the "text" and "string" type names
* [BooleanPropertyEditor]($ui-components) - registered for the "bool" and "boolean" type names
* [ColorPropertyEditor]($ui-components) - registered for the "number" type name and "color-picker" editor name
* [EnumPropertyButtonGroupEditor]($ui-components) - registered for the "enum" type name and the "enum-buttongroup" editor name
* [EnumPropertyEditor]($ui-components) - registered for the "enum" type name
* [TogglePropertyEditor]($ui-components) - registered for the "bool" and "boolean" type names and "toggle" editor name
* [WeightPropertyEditor]($ui-components) - registered for the "number" type name and "weight-picker" editor name

**Note**: `PropertyEditorManager.registerEditor` is called by the system for these delivered property editors.

## API Reference

* [PropertyEditors]($ui-components:PropertyEditors)
