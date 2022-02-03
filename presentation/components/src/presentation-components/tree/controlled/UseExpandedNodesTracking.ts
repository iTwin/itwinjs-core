/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useEffect, useRef } from "react";
import { Guid } from "@itwin/core-bentley";
import { Presentation } from "@itwin/presentation-frontend";
import type { TreeModelSource, TreeNodeItem } from "@itwin/components-react";
import { getVisibleDescendants, isTreeModelNode } from "@itwin/components-react";
import type { IPresentationTreeDataProvider } from "../IPresentationTreeDataProvider";

/** @internal */
export interface UseExpandedNodesTrackingProps {
  modelSource: TreeModelSource;
  dataProvider: IPresentationTreeDataProvider;
  enableNodesTracking: boolean;
}

/** @internal */
export function useExpandedNodesTracking(props: UseExpandedNodesTrackingProps) {
  const { modelSource, dataProvider } = props;
  const componentId = useRef(Guid.createValue());

  useEffect(() => {
    if (!props.enableNodesTracking)
      return;
    const sourceId = componentId.current;

    const updateExpandedNodes = () => {
      if (!Presentation.presentation.stateTracker)
        return;

      const expandedNodes = getExpandedNodeItems(modelSource).map((item) => ({ id: item.id, key: dataProvider.getNodeKey(item) }));
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      Presentation.presentation.stateTracker.onExpandedNodesChanged(dataProvider.imodel, dataProvider.rulesetId, sourceId, expandedNodes);
    };
    const removeModelChangeListener = modelSource.onModelChanged.addListener(updateExpandedNodes);
    updateExpandedNodes();

    return () => {
      removeModelChangeListener();
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      Presentation.presentation.stateTracker?.onHierarchyClosed(dataProvider.imodel, dataProvider.rulesetId, sourceId);
    };
  }, [modelSource, dataProvider, props.enableNodesTracking]);
}

/** @internal */
export function getExpandedNodeItems(modelSource: TreeModelSource) {
  const expandedItems = new Array<TreeNodeItem>();
  for (const node of getVisibleDescendants(modelSource.getModel(), modelSource.getModel().getRootNode())) {
    if (isTreeModelNode(node) && node.isExpanded)
      expandedItems.push(node.item);
  }
  return expandedItems;
}
