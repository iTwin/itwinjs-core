/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useEffect, useRef } from "react";
import { Guid } from "@bentley/bentleyjs-core";
import { TreeModel, TreeModelChanges, TreeModelSource } from "@bentley/ui-components";
import { NodeIdentifier, Presentation } from "@bentley/presentation-frontend";
import { IPresentationTreeDataProvider } from "../IPresentationTreeDataProvider";

/** @internal */
export interface UseExpandedNodesTrackingProps {
  modelSource: TreeModelSource;
  dataProvider: IPresentationTreeDataProvider;
  enableAutoUpdate: boolean;
}

/** @internal */
export function useExpandedNodesTracking(props: UseExpandedNodesTrackingProps) {
  const { modelSource, dataProvider, enableAutoUpdate } = props;
  const prevModel = useRef<TreeModel>(modelSource.getModel());
  const componentId = useRef(Guid.createValue());

  useEffect(() => {
    if (!enableAutoUpdate)
      return;

    const sourceId = componentId.current;
    const removeModelChangeListener = modelSource.onModelChanged.addListener(([model, changes]) => {
      if (!Presentation.presentation.stateTracker) {
        prevModel.current = model;
        return;
      }

      const { expandedNodes, collapsedNodes } = getExpandedCollapsedNodes(prevModel.current, model, changes, dataProvider);
      prevModel.current = model;

      if (expandedNodes.length !== 0) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        Presentation.presentation.stateTracker.onNodesExpanded(dataProvider.imodel, dataProvider.rulesetId, sourceId, expandedNodes);
      }
      if (collapsedNodes.length !== 0) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        Presentation.presentation.stateTracker.onNodesCollapsed(dataProvider.imodel, dataProvider.rulesetId, sourceId, collapsedNodes);
      }
    });

    return () => {
      removeModelChangeListener();
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      Presentation.presentation.stateTracker?.onHierarchyClosed(dataProvider.imodel, dataProvider.rulesetId, sourceId);
    };
  }, [modelSource, dataProvider, enableAutoUpdate]);
}

function getExpandedCollapsedNodes(prevModel: TreeModel, currModel: TreeModel, changes: TreeModelChanges, dataProvider: IPresentationTreeDataProvider) {
  const expandedNodes: NodeIdentifier[] = [];
  const collapsedNodes: NodeIdentifier[] = [];
  // model was empty check if expanded root nodes were added
  if (prevModel.getRootNode().numChildren === undefined) {
    for (const nodeId of changes.addedNodeIds) {
      const node = currModel.getNode(nodeId);
      // istanbul ignore if
      if (!node)
        continue;

      if (node.isExpanded)
        expandedNodes.push({ id: node.id, key: dataProvider.getNodeKey(node.item) });
    }
  }

  // check modified nodes
  for (const nodeId of changes.modifiedNodeIds) {
    const prevNode = prevModel.getNode(nodeId);
    const currNode = currModel.getNode(nodeId);
    // istanbul ignore if
    if (!prevNode || !currNode)
      continue;

    if (!prevNode.isExpanded && currNode.isExpanded) {
      expandedNodes.push({ id: currNode.id, key: dataProvider.getNodeKey(currNode.item) });
      // add all child nodes of this node that are already in the model and are expanded
      expandedNodes.push(...collectExpandedChildren(currModel, currNode.id, dataProvider));
    } else if (prevNode.isExpanded && !currNode.isExpanded) {
      collapsedNodes.push({ id: currNode.id, key: dataProvider.getNodeKey(currNode.item) });
      // add all child nodes of this node that were in the model and were expanded
      collapsedNodes.push(...collectExpandedChildren(prevModel, prevNode.id, dataProvider));
    }
  }
  return { expandedNodes, collapsedNodes };
}

function collectExpandedChildren(model: TreeModel, parentId: string, dataProvider: IPresentationTreeDataProvider) {
  const expandedNodes: NodeIdentifier[] = [];
  for (const node of model.iterateTreeModelNodes(parentId)) {
    if (node.isExpanded)
      expandedNodes.push({ id: node.id, key: dataProvider.getNodeKey(node.item) });
  }
  return expandedNodes;
}
