# Tree

The [Tree]($ui-components:Tree) category in the `@bentley/ui-components` package includes
classes and components for working with a Tree control.

## Components and Hooks

The older Tree component has been deprecated and replaced by the [ControlledTree]($ui-components) component.

The following React components comprise the ControlledTree component.

- [ControlledTree]($ui-components) - renders hierarchical data and is fully controlled from outside
- [TreeRenderer]($ui-components) - default component for rendering the tree
- [TreeNodeRenderer]($ui-components) - default component for rendering tree nodes

There are also several [Tree]($ui-core:Tree) presentational  components in the `@bentley/ui-core`
package used for rendering.

The following React hooks work in conjunction with the ControlledTree component.

- [usePagedTreeNodeLoader]($ui-components) - creates a paging nodes' loader using the supplied data provider and model source. The loader pulls nodes from the data provider and puts them into the model source.
- [useTreeModelSource]($ui-components) - creates a [TreeModelSource]($ui-components)
- [useTreeNodeLoader]($ui-components) - creates a nodes' loader using the supplied data provider and model source. The loader pulls nodes from the data provider and puts them into the model source.
- [useVisibleTreeNodes]($ui-components) - returns a flat list of visible nodes from given [TreeModelSource]($ui-components) and subscribes to onModelChanged event to update the list when model changes
- [usePresentationTreeNodeLoader]($presentation-components) -  creates a [PagedTreeNodeLoader]($$ui-components) with [PresentationTreeDataProvider]($presentation-components) using supplied imodel and ruleset
- [useUnifiedSelectionTreeEventHandler]($presentation-components) - creates and disposes [UnifiedSelectionTreeEventHandler]($presentation-components)

## Tree Node Loader, Data Provider and Model

The following classes and interfaces comprise the Tree Node Loader, Data Provider and Model.
The Node Loader is used to load tree nodes and is passed to the ControlledTree by the `nodeLoader` prop.
The Data Provider is a legacy provider but is still supported by the Node Loader.

### Node Loader

- [ITreeNodeLoader]($ui-components) - interface for the Tree node loader which is used to load tree nodes
- [ITreeNodeLoaderWithProvider]($ui-components) - interface for Tree node loader which uses [TreeDataProvider]($ui-components) to load nodes

### Data Provider

- [ITreeDataProvider]($ui-components) - legacy interface for a Tree data provider
- [TreeDataProvider]($ui-components) - type definition for all Tree data providers
- [TreeNodeItem]($ui-components) - information about a node item which can be displayed in a Tree
- [EditableTreeDataProvider]($ui-components) - provides cell editing processing for the Tree
- [IPresentationTreeDataProvider]($presentation-components) - Presentation Rules tree data provider

### Model

- [TreeModel]($ui-components) - interface that describes a tree model containing methods to get the root node and nodes by id and parent id
- [TreeModelNode]($ui-components) - immutable data structure that describes tree node
- [MutableTreeModelNode]($ui-components) - mutable data structure that describes tree node
- [VisibleTreeNodes]($ui-components) - interface that describes the set of visible tree nodes as a flat list
- [TreeModelSource]($ui-components) - controls tree model and visible tree nodes. It is used to modify model and inform when tree model changes.
- [MutableTreeModel]($ui-components) - implementation of TreeModel that allows adding and removing tree nodes

## Properties

The ControlledTree properties are defined in the [ControlledTreeProps]($ui-components) interface.

The following props are required:

- `visibleNodes` - the flat list of nodes to be rendered in tree
- `nodeLoader` - the Node Loader used to load root nodes and placeholder nodes
- `treeEvents` - the tree events handler
- `selectionMode` - Mode of nodes' selection in tree

The optional props include overrides for renderers,
flags for enabling descriptions and icons,
and node highlighting props.

## Sample using Presentation Rules

This React component utilizes the [ControlledTree]($ui-components) component and the
[useVisibleTreeNodes]($ui-components),
[usePresentationTreeNodeLoader]($presentation-components) and
[useUnifiedSelectionTreeEventHandler]($presentation-components) hooks.
This tree supports unified selection.

```tsx
import * as React from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { ControlledTree, useVisibleTreeNodes, SelectionMode } from "@bentley/ui-components";
import { usePresentationTreeNodeLoader, useUnifiedSelectionTreeEventHandler } from "@bentley/presentation-components";
const RULESET_TREE = require("./Tree.ruleset.json"); // eslint-disable-line @typescript-eslint/no-var-requires

/** React properties for the tree component */
export interface Props {
  /** iModel whose contents should be displayed in the tree */
  imodel: IModelConnection;
}

/** Tree component for the viewer app */
export default function SimpleTreeComponent(props: Props) {
  const nodeLoader = usePresentationTreeNodeLoader({ imodel: props.imodel, ruleset: RULESET_TREE, pageSize: 20 });
  return (
    <ControlledTree
      nodeLoader={nodeLoader}
      visibleNodes={useVisibleTreeNodes(nodeLoader.modelSource)}
      treeEvents={useUnifiedSelectionTreeEventHandler({ nodeLoader })}
      selectionMode={SelectionMode.Extended}
    />
  );
}
```

## API Reference

- [Tree in @bentley/ui-components]($ui-components:Tree)
- [Tree in @bentley/presentation-components]($presentation-components:Tree)
- [Tree in @bentley/ui-core]($ui-core:Tree)
- [Properties in @bentley/ui-components]($ui-components:Properties)
- [Properties in @bentley/ui-abstract]($ui-abstract:Properties)

## Samples

- [simple-viewer-app](https://github.com/imodeljs/imodeljs-samples/tree/master/interactive-app/simple-viewer-app): An example of an interactive application which can display graphical data, browse iModel catalog and view element properties.
<!-- * [controlled-tree-sample](https://github.com/imodeljs/imodeljs-samples/tree/master/interactive-app/controlled-tree-sample): An example of an application demonstrating the many features of the ControlledTree. -->
