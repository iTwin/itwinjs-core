/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useEffect, useRef } from "react";
import { getVisibleDescendants, isTreeModelNode, TreeModelSource, TreeNodeItem } from "@itwin/components-react";
import { Guid } from "@itwin/core-bentley";
import { NodeState, Presentation } from "@itwin/presentation-frontend";
import { IPresentationTreeDataProvider } from "../IPresentationTreeDataProvider";

/** @internal */
export interface UseHierarchyStateTrackingProps {
  modelSource: TreeModelSource;
  dataProvider: IPresentationTreeDataProvider;
  enableTracking: boolean;
}

/** @internal */
export function useHierarchyStateTracking(props: UseHierarchyStateTrackingProps) {
  const { modelSource, dataProvider } = props;
  const componentId = useRef(Guid.createValue());

  useEffect(() => {
    if (!props.enableTracking)
      return;

    const sourceId = componentId.current;

    const updateNodeStates = () => {
      if (!Presentation.presentation.stateTracker)
        return;

      const nodeStates = getNodeStates(modelSource).map((itemState) => {
        const { item, ...state } = itemState;
        return {
          node: item
            ? { id: item.id, key: dataProvider.getNodeKey(item) }
            : /* istanbul ignore next */ undefined, // TODO: enable this when we start tracking more than just `isExpanded` state flag
          state,
        };
      });
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      Presentation.presentation.stateTracker.onHierarchyStateChanged(dataProvider.imodel, dataProvider.rulesetId, sourceId, nodeStates);
    };
    const removeModelChangeListener = modelSource.onModelChanged.addListener(updateNodeStates);
    updateNodeStates();

    return () => {
      removeModelChangeListener();
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      Presentation.presentation.stateTracker?.onHierarchyClosed(dataProvider.imodel, dataProvider.rulesetId, sourceId);
    };
  }, [modelSource, dataProvider, props.enableTracking]);
}

/** @internal */
export function getNodeStates(modelSource: TreeModelSource) {
  const states = new Array<NodeState & { item: TreeNodeItem | undefined }>();
  for (const node of getVisibleDescendants(modelSource.getModel(), modelSource.getModel().getRootNode())) {
    if (isTreeModelNode(node) && node.isExpanded)
      states.push({ item: node.item, isExpanded: true });
  }
  return states;
}
