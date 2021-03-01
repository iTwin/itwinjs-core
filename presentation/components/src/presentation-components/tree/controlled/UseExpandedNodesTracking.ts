/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useEffect, useRef } from "react";
import { Guid } from "@bentley/bentleyjs-core";
import { isTreeModelNode, TreeModelSource, TreeNodeItem } from "@bentley/ui-components";
import { Presentation } from "@bentley/presentation-frontend";
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
  const componentId = useRef(Guid.createValue());

  useEffect(() => {
    if (!enableAutoUpdate)
      return;

    const sourceId = componentId.current;
    const removeModelChangeListener = modelSource.onModelChanged.addListener(() => {
      if (!Presentation.presentation.stateTracker)
        return;

      const expandedNodes = getExpandedNodeItems(modelSource).map((item) => ({ id: item.id, key: dataProvider.getNodeKey(item) }));
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      Presentation.presentation.stateTracker.onExpandedNodesChanged(dataProvider.imodel, dataProvider.rulesetId, sourceId, expandedNodes);
    });

    return () => {
      removeModelChangeListener();
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      Presentation.presentation.stateTracker?.onHierarchyClosed(dataProvider.imodel, dataProvider.rulesetId, sourceId);
    };
  }, [modelSource, dataProvider, enableAutoUpdate]);
}

/** @internal */
export function getExpandedNodeItems(modelSource: TreeModelSource) {
  const expandedItems = new Array<TreeNodeItem>();
  for (const node of modelSource.getVisibleNodes()) {
    if (isTreeModelNode(node) && node.isExpanded)
      expandedItems.push(node.item);
  }
  return expandedItems;
}
