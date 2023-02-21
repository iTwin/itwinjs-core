/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import { isTreeModelNode, ITreeNodeLoader, TreeModelSource, TreeNodeItem } from "@itwin/components-react";
import * as React from "react";
import { PresentationInstanceFilterInfo } from "../../instance-filter-builder/PresentationInstanceFilterBuilder";
import { isPresentationTreeNodeItem } from "../PresentationTreeNodeItem";

/**
 * Props for [[useHierarchyLevelFiltering]] hook.
 * @beta
 */
export interface UseHierarchyLevelFilteringProps {
  nodeLoader: ITreeNodeLoader;
  modelSource: TreeModelSource;
}

/**
 * Custom hook that creates callbacks for filtering hierarchy levels in the tree. Filtering works only with trees based on
 * [[PresentationTreeDataProvider]].
 * @beta
 */
export function useHierarchyLevelFiltering(props: UseHierarchyLevelFilteringProps) {
  const { nodeLoader, modelSource } = props;

  const applyFilter = React.useCallback((node: TreeNodeItem, info: PresentationInstanceFilterInfo) => {
    applyHierarchyLevelFilter(nodeLoader, modelSource, node.id, info);
  }, [nodeLoader, modelSource]);

  const clearFilter = React.useCallback((node: TreeNodeItem) => {
    applyHierarchyLevelFilter(nodeLoader, modelSource, node.id);
  }, [nodeLoader, modelSource]);

  return { applyFilter, clearFilter };
}

function applyHierarchyLevelFilter(nodeLoader: ITreeNodeLoader, modelSource: TreeModelSource, nodeId: string, filter?: PresentationInstanceFilterInfo) {
  modelSource.modifyModel((model) => {
    const modelNode = model.getNode(nodeId);
    if (!modelNode || !isTreeModelNode(modelNode) || !isPresentationTreeNodeItem(modelNode.item) || !modelNode.item.filtering)
      return;

    modelNode.item.filtering.active = filter;
    if (filter)
      modelNode.isExpanded = true;
    model.clearChildren(nodeId);
  });

  const updatedNode = modelSource.getModel().getNode(nodeId);
  if (updatedNode === undefined || !updatedNode.isExpanded || updatedNode.numChildren !== undefined)
    return;
  nodeLoader.loadNode(updatedNode, 0).subscribe();
}
