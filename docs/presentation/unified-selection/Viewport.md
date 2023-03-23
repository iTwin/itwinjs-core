# Setting up a Viewport component for Unified Selection

As described in the [Viewport selection handling section](./index.md#viewport), selection in a Viewport component and Unified Selection are synchronized in a two-way manner:

- When an element in the Viewport is selected, it (or anything that comes from it after applying active [selection scope](./index.md#selection-scopes)) is added to unified selection.
- When an *ECInstance* is added to unified selection, all `BisCore.Elements` that represent that *ECInstances* are added to the Viewport's hilite set.

## Reference

The [Reference section in Unified Selection page](./index.md#reference) describes the core APIs used in Unified Selection workflows.

The `@itwin/presentation-components` package delivers [viewWithUnifiedSelection]($presentation-components) HOC to make setting up Viewport components to work with Unified Selection easier. The HOC takes a [ViewportComponent]($imodel-components-react) and returns a new Viewport component that synchronizes with Unified Selection.

## Example

The below example shows how to create a Viewport component and hook it into Unified Selection. The latter part is achieved by using [viewWithUnifiedSelection]($presentation-components) HOC.

```tsx
[[include:Presentation.Components.UnifiedSelection.Viewport]]
```
