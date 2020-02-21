/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

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
import { HighlightableTreeProps } from "../../HighlightingEngine";
import { TreeImageLoader } from "../../ImageLoader";

/**
 * Properties for [[ControlledTree]]
 * @beta
 */
export interface ControlledTreeProps extends CommonProps {
  /** Flat list of nodes to be rendered in tree. */
  visibleNodes: VisibleTreeNodes;
  /** Node loader used to load root nodes and placeholder nodes. */
  nodeLoader: ITreeNodeLoader;
  /** Tree events handler. */
  treeEvents: TreeEvents;
  /** Mode of nodes' selection in tree. */
  selectionMode: SelectionMode;
  /** Specifies whether to show node description or not. It is used in default node renderer and to determine node height.
   * If custom node renderer and node height callbacks are used it does nothing.
   */
  descriptionsEnabled?: boolean;
  /** Specifies whether to show node icon or not. It is used in default node renderer.
   * If custom node renderer is used it does nothing.
   */
  iconsEnabled?: boolean;
  /** Used to highlight matches when filtering tree.
   * It is passed to treeRenderer.
   */
  nodeHighlightingProps?: HighlightableTreeProps;
  /** Custom renderer to be used to render a tree. */
  treeRenderer?: (props: TreeRendererProps) => React.ReactElement;
  /** Custom renderer to be used while root nodes is loading. */
  spinnerRenderer?: () => React.ReactElement;
  /** Custom renderer to be used when there is no data to show in tree. */
  noDataRenderer?: () => React.ReactElement;
}

/**
 * React tree component which rendering is fully controlled from outside.
 * @beta
 */
export const ControlledTree: React.FC<ControlledTreeProps> = (props: ControlledTreeProps) => { // tslint:disable-line: variable-name
  const nodeHeight = useNodeHeight(!!props.descriptionsEnabled);
  const imageLoader = useMemo(() => new TreeImageLoader(), []);
  const nodeRenderer = useCallback((nodeProps: TreeNodeRendererProps) => (
    <TreeNodeRenderer
      {...nodeProps}
      descriptionEnabled={props.descriptionsEnabled}
      imageLoader={props.iconsEnabled ? imageLoader : undefined}
    />
  ), [props.descriptionsEnabled, props.iconsEnabled, imageLoader]);

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
