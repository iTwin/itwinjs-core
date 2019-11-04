/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import { TreeModelNode, VisibleTreeNodes, isTreeModelNode, TreeModelNodePlaceholder } from "../TreeModel";
import { TreeNodeRenderer, TreeNodeRendererProps } from "./TreeNodeRenderer";
import { TreeRenderer, TreeRendererProps } from "./TreeRenderer";

import { CommonProps, Spinner, SpinnerSize } from "@bentley/ui-core";

import * as React from "react";
// tslint:disable-next-line: no-duplicate-imports
import { useCallback, useEffect, useMemo } from "react";
import { TreeNodeLoader } from "../TreeModelSource";

import { from } from "rxjs/internal/observable/from";
import { UiComponents } from "../../../UiComponents";
import { TreeEvents } from "../TreeEvents";
import { TreeEventDispatcher } from "../TreeEventDispatcher";
import { SelectionMode } from "../../../common/selection/SelectionModes";

/**
 * Properties for [[ControlledTree]]
 * @alpha
 */
export interface ControlledTreeProps extends CommonProps {
  visibleNodes: VisibleTreeNodes;
  nodeLoader: TreeNodeLoader;
  treeEvents: TreeEvents;
  descriptionsEnabled?: boolean;
  selectionMode: SelectionMode;
  treeRenderer?: (props: TreeRendererProps) => React.ReactElement;
  spinnerRenderer?: () => React.ReactElement;
  noDataRenderer?: () => React.ReactElement;
}

/**
 * React tree component which rendering is fully controlled from outside.
 * @alpha
 */
// tslint:disable-next-line: variable-name
export const ControlledTree: React.FC<ControlledTreeProps> = (props: ControlledTreeProps) => {
  const nodeHeight = useNodeHeight(!!props.descriptionsEnabled);
  const nodeRenderer = useCallback((nodeProps: TreeNodeRendererProps) => (
    <TreeNodeRenderer
      {...nodeProps}
      descriptionEnabled={props.descriptionsEnabled}
    />
  ), [props.descriptionsEnabled]);

  const eventDispatcher = useEventDispatcher(props.nodeLoader, props.treeEvents, props.selectionMode, props.visibleNodes);

  const treeProps: TreeRendererProps = useMemo(() => ({
    nodeRenderer,
    nodeHeight,
    treeActions: eventDispatcher,
    nodeLoader: props.nodeLoader,
    visibleNodes: props.visibleNodes,
  }), [nodeRenderer, nodeHeight, eventDispatcher, props.nodeLoader, props.visibleNodes]);

  const loading = useRootNodeLoader(props.visibleNodes, props.nodeLoader);
  const noData = props.visibleNodes.getNumRootNodes() === 0;
  return (
    <Loader loading={loading} noData={noData} spinnerRenderer={props.spinnerRenderer} noDataRenderer={props.noDataRenderer}>
      {props.treeRenderer ? props.treeRenderer(treeProps) : <TreeRenderer {...treeProps} />}
    </Loader>
  );
};

function useRootNodeLoader(visibleNodes: VisibleTreeNodes, nodeLoader: TreeNodeLoader): boolean {
  useEffect(() => {
    if (visibleNodes.getNumRootNodes() === undefined) {
      const subscription = from(nodeLoader.loadNode(undefined, 0)).subscribe();
      return () => subscription.unsubscribe();
    }

    return () => { };
  }, [visibleNodes, nodeLoader]);

  return visibleNodes.getNumRootNodes() === undefined;
}

function useEventDispatcher(nodeLoader: TreeNodeLoader, treeEvents: TreeEvents, selectionMode: SelectionMode, visibleNodes: VisibleTreeNodes) {
  /* istanbul ignore next */
  const getVisibleNodes = useCallback(() => visibleNodes, [visibleNodes]);
  const eventDispatcher = useMemo(() => new TreeEventDispatcher(treeEvents, nodeLoader, selectionMode), [treeEvents, nodeLoader, selectionMode]);

  useEffect(() => {
    eventDispatcher.setVisibleNodes(getVisibleNodes);
  }, [eventDispatcher, getVisibleNodes]);

  return eventDispatcher;
}

interface LoaderProps {
  loading: boolean;
  noData: boolean;
  spinnerRenderer?: () => React.ReactElement;
  noDataRenderer?: () => React.ReactElement;
  children: JSX.Element;
}

// tslint:disable-next-line: variable-name
const Loader: React.FC<LoaderProps> = (props) => {
  if (props.loading) {
    return props.spinnerRenderer
      ? props.spinnerRenderer()
      : (
        <div className="components-tree-loader">
          <Spinner size={SpinnerSize.Large} />
        </div>
      );
  }
  if (props.noData) {
    return props.noDataRenderer
      ? props.noDataRenderer()
      : (
        <p className="components-tree-errormessage">
          {UiComponents.translate("general.noData")}
        </p>
      );
  }

  return props.children;
};

function useNodeHeight(
  descriptionsEnabled: boolean,
): (node: TreeModelNode | TreeModelNodePlaceholder) => number {
  return useCallback(
    (node: TreeModelNode | TreeModelNodePlaceholder): number => {
      const contentHeight = (isTreeModelNode(node) && descriptionsEnabled && node && node.description) ? 43 : 24;
      const borderSize = 1;
      // Not counting node's border size twice because we want neighboring borders to overlap
      return contentHeight + borderSize;
    },
    [descriptionsEnabled],
  );
}
