/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as React from "react";
// tslint:disable-next-line: no-duplicate-imports
import { useCallback, useEffect, useMemo } from "react";
import { from } from "rxjs/internal/observable/from";
import { CommonProps, Spinner, SpinnerSize } from "@bentley/ui-core";
import { TreeModelNode, VisibleTreeNodes, isTreeModelNode, TreeModelNodePlaceholder } from "../TreeModel";
import { TreeNodeRenderer, TreeNodeRendererProps } from "./TreeNodeRenderer";
import { TreeRenderer, TreeRendererProps } from "./TreeRenderer";
import { ITreeNodeLoader } from "../TreeNodeLoader";
import { UiComponents } from "../../../UiComponents";
import { TreeEvents } from "../TreeEvents";
import { TreeEventDispatcher } from "../TreeEventDispatcher";
import { SelectionMode } from "../../../common/selection/SelectionModes";
import { HighlightableTreeProps, HighlightingEngine } from "../../HighlightingEngine";

/**
 * Properties for [[ControlledTree]]
 * @alpha
 */
export interface ControlledTreeProps extends CommonProps {
  visibleNodes: VisibleTreeNodes;
  nodeLoader: ITreeNodeLoader;
  treeEvents: TreeEvents;
  descriptionsEnabled?: boolean;
  selectionMode: SelectionMode;
  nodeHighlightingProps?: HighlightableTreeProps;
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
  const highlightingEngine = useMemo(() => props.nodeHighlightingProps ? new HighlightingEngine(props.nodeHighlightingProps) : undefined, [props.nodeHighlightingProps]);
  const nodeHeight = useNodeHeight(!!props.descriptionsEnabled);
  const nodeRenderer = useCallback((nodeProps: TreeNodeRendererProps) => (
    <TreeNodeRenderer
      {...nodeProps}
      descriptionEnabled={props.descriptionsEnabled}
      nodeHighlightProps={highlightingEngine ? highlightingEngine.createRenderProps(nodeProps.node) : undefined}
    />
  ), [props.descriptionsEnabled, highlightingEngine]);

  const eventDispatcher = useEventDispatcher(props.nodeLoader, props.treeEvents, props.selectionMode, props.visibleNodes);

  const treeProps: TreeRendererProps = useMemo(() => ({
    nodeRenderer,
    nodeHeight,
    treeActions: eventDispatcher,
    nodeLoader: props.nodeLoader,
    visibleNodes: props.visibleNodes,
    nodeHighlightingProps: props.nodeHighlightingProps,
  }), [nodeRenderer, nodeHeight, eventDispatcher, props.nodeLoader, props.visibleNodes, props.nodeHighlightingProps]);

  const loading = useRootNodeLoader(props.visibleNodes, props.nodeLoader);
  const noData = props.visibleNodes.getNumRootNodes() === 0;
  return (
    <Loader loading={loading} noData={noData} spinnerRenderer={props.spinnerRenderer} noDataRenderer={props.noDataRenderer}>
      {props.treeRenderer ? props.treeRenderer(treeProps) : <TreeRenderer {...treeProps} />}
    </Loader>
  );
};

function useRootNodeLoader(visibleNodes: VisibleTreeNodes, nodeLoader: ITreeNodeLoader): boolean {
  useEffect(() => {
    if (visibleNodes.getNumRootNodes() === undefined) {
      const subscription = from(nodeLoader.loadNode(visibleNodes.getModel().getRootNode(), 0)).subscribe();
      return () => subscription.unsubscribe();
    }

    return () => { };
  }, [visibleNodes, nodeLoader]);

  return visibleNodes.getNumRootNodes() === undefined;
}

function useEventDispatcher(nodeLoader: ITreeNodeLoader, treeEvents: TreeEvents, selectionMode: SelectionMode, visibleNodes: VisibleTreeNodes) {
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
