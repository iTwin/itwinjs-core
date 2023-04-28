# Setting up a Tree component for Unified Selection

As described in the [Tree selection handling section](./index.md#tree), selection in a Tree component and Unified Selection are synchronized in a two-way manner:

- When a tree node is selected, _ECInstances_ it represents are added to unified selection.
- When an _ECInstance_ is added to unified selection, the nodes that represent that _ECInstance_ are selected in the tree component.

## Reference

The [Reference section in Unified Selection page](./index.md#reference) describes the core APIs used in Unified Selection workflows.

The `@itwin/presentation-components` package delivers some helper APIs to make setting up Tree components to work with Unified Selection easier:

- [useUnifiedSelectionTreeEventHandler]($presentation-components) hook is here for majority of the situations. It merely creates the default [UnifiedSelectionTreeEventHandler]($presentation-components) and makes sure it's disposed when necessary.

- [UnifiedSelectionTreeEventHandler]($presentation-components) is expected to be used directly in more advanced situations - when the tree component handles not only nodes' expand/collapse and selection, but also some custom actions that need to be implemented in a custom handler. In this situation consumers are expected to take care of creating and disposing their event handler on their own.

## Example

The below example shows how to create a very basic presentation rules driven Tree component and hook it into Unified Selection. The latter part is achieved by using [useUnifiedSelectionTreeEventHandler]($presentation-components) to create a tree event handler, as opposed to using the general [useTreeEventsHandler]($components-react).

```tsx
[[include:Presentation.Components.UnifiedSelection.Tree]]
```
