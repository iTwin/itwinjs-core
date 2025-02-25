# Setting up a Property Grid component for Unified Selection

> **Warning:** The page refers to a deprecated unified selection system. Please see [`@itwin/unified-selection`](https://www.npmjs.com/package/@itwin/unified-selection) and [Migrating from `@itwin/presentation-frontend` unified selection API](https://github.com/iTwin/presentation/blob/master/packages/unified-selection/learning/MigrationGuide.md) learning page for details on how to migrate to new system.

As described in the [Property Grid selection handling section](./index.md#property-grid), interaction between the Property Grid component and Unified Selection is one way - from Unified Selection to the Property Grid. That means that whenever Unified Selection changes, the content in the Property Grid is reloaded to represent what is selected.

## Reference

The [Reference section in Unified Selection page](./index.md#reference) describes the core APIs used in Unified Selection workflows.

The `@itwin/presentation-components` package delivers [usePropertyDataProviderWithUnifiedSelection]($presentation-components) hook to make setting up Property Grid components to work with Unified Selection easier. The hook takes an [IPresentationPropertyDataProvider]($presentation-components) and updates its `keys` prop whenever Unified Selection changes.

## Example

The below example shows how to create a very basic presentation rules driven Property Grid component and hook it into Unified Selection. The latter part is achieved by using [usePropertyDataProviderWithUnifiedSelection]($presentation-components) on the data provider.

```tsx
[[include:Presentation.Components.UnifiedSelection.PropertyGrid]]
```
