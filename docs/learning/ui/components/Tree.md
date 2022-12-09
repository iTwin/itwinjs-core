# Tree

The [Tree]($components-react:Tree) category in the `@itwin/components-react` package includes
classes and components for working with a Tree control.

## Components and Hooks

The older Tree component has been deprecated and replaced by the [ControlledTree]($components-react) component.

The following React components comprise the ControlledTree component.

- [ControlledTree]($components-react) - renders hierarchical data and is fully controlled from outside
- [TreeRenderer]($components-react) - default component for rendering the tree
- [TreeNodeRenderer]($components-react) - default component for rendering tree nodes

There are also several [Tree]($core-react:Tree) presentational  components in the `@itwin/core-react`
package used for rendering.

The following React hooks work in conjunction with the ControlledTree component.

- [usePagedTreeNodeLoader]($components-react) - creates a paging nodes' loader using the supplied data provider and model source. The loader pulls nodes from the data provider and puts them into the model source.
- [useTreeModelSource]($components-react) - creates a [TreeModelSource]($components-react)
- [useTreeModel]($components-react) - returns an immutable [TreeModel]($components-react) from given [TreeModelSource]($components-react) and subscribes to `onModelChanged` event to update the model when it changes.
- [useTreeNodeLoader]($components-react) - creates a nodes' loader using the supplied data provider and model source. The loader pulls nodes from the data provider and puts them into the model source.
- [usePresentationTreeNodeLoader]($presentation-components) -  creates a [PagedTreeNodeLoader]($$components-react) with [PresentationTreeDataProvider]($presentation-components) using supplied imodel and ruleset
- [useUnifiedSelectionTreeEventHandler]($presentation-components) - creates and disposes [UnifiedSelectionTreeEventHandler]($presentation-components)

## Tree Node Loader, Data Provider and Model

The following classes and interfaces comprise the Tree Node Loader, Data Provider and Model.
The Node Loader is used to load tree nodes and is passed to the ControlledTree by the `nodeLoader` prop.
The Data Provider is a legacy provider but is still supported by the Node Loader.

### Node Loader

- [ITreeNodeLoader]($components-react) - interface for the Tree node loader which is used to load tree nodes
- [ITreeNodeLoaderWithProvider]($components-react) - interface for Tree node loader which uses [TreeDataProvider]($components-react) to load nodes

### Data Provider

- [ITreeDataProvider]($components-react) - legacy interface for a Tree data provider
- [TreeDataProvider]($components-react) - type definition for all Tree data providers
- [TreeNodeItem]($components-react) - information about a node item which can be displayed in a Tree
- [EditableTreeDataProvider]($components-react) - provides cell editing processing for the Tree
- [IPresentationTreeDataProvider]($presentation-components) - Presentation Rules tree data provider

### Model

- [TreeModel]($components-react) - interface that describes a tree model containing methods to get the root node and nodes by id and parent id
- [TreeModelNode]($components-react) - immutable data structure that describes tree node
- [MutableTreeModelNode]($components-react) - mutable data structure that describes tree node
- [VisibleTreeNodes]($components-react) - interface that describes the set of visible tree nodes as a flat list
- [TreeModelSource]($components-react) - controls tree model and visible tree nodes. It is used to modify model and inform when tree model changes.
- [MutableTreeModel]($components-react) - implementation of TreeModel that allows adding and removing tree nodes

## Properties

The ControlledTree properties are defined in the [ControlledTreeProps]($components-react) interface.

The following props are required:

- `visibleNodes` - the flat list of nodes to be rendered in tree
- `nodeLoader` - the Node Loader used to load root nodes and placeholder nodes
- `treeEvents` - the tree events handler
- `selectionMode` - Mode of nodes' selection in tree

The optional props include overrides for renderers,
flags for enabling descriptions and icons,
and node highlighting props.

## Sample using Presentation Rules

This React component utilizes the [ControlledTree]($components-react) component and the
[useTreeModel]($components-react), [usePresentationTreeNodeLoader]($presentation-components) and
[useUnifiedSelectionTreeEventHandler]($presentation-components) hooks. This tree supports unified selection.

```tsx
import * as React from "react";
import { IModelConnection } from "@itwin/core-frontend";
import { ControlledTree, useTreeModel, SelectionMode } from "@itwin/components-react";
import { usePresentationTreeNodeLoader, useUnifiedSelectionTreeEventHandler } from "@itwin/presentation-components";
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
      model={useTreeModel(nodeLoader.modelSource)}
      treeEvents={useUnifiedSelectionTreeEventHandler({ nodeLoader })}
      selectionMode={SelectionMode.Extended}
    />
  );
}
```

## API Reference

- [Tree in @itwin/components-react]($components-react:Tree)
- [Tree in @itwin/presentation-components]($presentation-components:Tree)
- [Tree in @itwin/core-react]($core-react:Tree)
- [Properties in @itwin/components-react]($components-react:Properties)
- [Properties in @itwin/appui-abstract]($appui-abstract:Properties)
