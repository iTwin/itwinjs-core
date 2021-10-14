# PropertyEditors

The [PropertyEditors]($components-react:PropertyEditors) category in the `@itwin/components-react` package includes
classes and components for working with Property Editors.
Property editors are used by the Table, Tree and PropertyGrid components for cell editing of properties.
Property editors have two pieces:

1. A class that extends [PropertyEditorBase]($components-react), is registered for a certain type name and optionally an editor name, and returns a React node for the editor component
1. A React component that implements [TypeEditor]($components-react) and renders the editor and processes user interaction

Each property editor must be registered with the [PropertyEditorManager]($components-react)
for a given type name, and optionally an editor name,
by calling the `registerEditor` method.

```ts
PropertyEditorManager.registerEditor("text", BasicPropertyEditor);
```

The [EditorContainer]($components-react) component is used by the Table, Tree and PropertyGrid for cell editing.
Those components render an EditorContainer in a cell when cell editing is invoked. The EditorContainer
creates the appropriate property editor based on the cell's [PropertyDescription]($appui-abstract),
which contains the type name and optional editor name.

The following is a list of the provided property editors:

- [BasicPropertyEditor]($components-react) - registered for the "text" and "string" type names
- [BooleanPropertyEditor]($components-react) - registered for the "bool" and "boolean" type names
- [ColorPropertyEditor]($imodel-components-react) - registered for the "number" type name and "color-picker" editor name
- [EnumPropertyButtonGroupEditor]($components-react) - registered for the "enum" type name and the "enum-buttongroup" editor name
- [EnumPropertyEditor]($components-react) - registered for the "enum" type name
- [ImageCheckBoxPropertyEditor]($components-react) - registered for the "bool" and "boolean" type names and "image-check-box" editor name
- [NumericInputPropertyEditor]($components-react) - registered for the "number" type name and "numeric-input" editor name
- [SliderPropertyEditor]($components-react) - registered for the "number" type name and "slider" editor name
- [TextareaPropertyEditor]($components-react) - registered for the "text" and "string" type names and "multi-line" editor name
- [ThemedEnumPropertyEditor]($components-react) - registered for the "enum" type name and "themed-enum" editor name
- [TogglePropertyEditor]($components-react) - registered for the "bool" and "boolean" type names and "toggle" editor name
- [WeightPropertyEditor]($imodel-components-react) - registered for the "number" type name and "weight-picker" editor name

**Note**: `PropertyEditorManager.registerEditor` is called by the system for these delivered property editors.

## Standard Type Names and Editor Names

The [StandardTypeNames]($appui-abstract) and [StandardEditorNames]($appui-abstract) enums can be used when populating a
[PropertyDescription]($appui-abstract). These enums contain the type and editor names used when registering the editors listed above.

## API Reference

- [PropertyEditors]($components-react:PropertyEditors)
