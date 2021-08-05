/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelComponents
 */

import "./SpatialContainmentTree.scss";
import * as React from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Ruleset } from "@bentley/presentation-common";
import { UnifiedSelectionTreeEventHandler, usePresentationTreeNodeLoader } from "@bentley/presentation-components";
import { ControlledTree, SelectionMode, useVisibleTreeNodes } from "@bentley/ui-components";
import { useDisposable } from "@bentley/ui-core";
import { connectIModelConnection } from "../../redux/connectIModel";
import { ClassGroupingOption } from "../Common";

const PAGING_SIZE = 20;

/** @internal */
export const RULESET_SPATIAL_BREAKDOWN: Ruleset = require("./SpatialBreakdown.json"); // eslint-disable-line @typescript-eslint/no-var-requires
/** @internal */
export const RULESET_SPATIAL_BREAKDOWN_GROUPED_BY_CLASS: Ruleset = require("./SpatialBreakdown.GroupedByClass.json"); // eslint-disable-line @typescript-eslint/no-var-requires

/**
 * Properties for the [[SpatialContainmentTree]] component
 * @public
 */
export interface SpatialContainmentTreeProps {
  iModel: IModelConnection;
  /**
   * Start loading hierarchy as soon as the component is created
   */
  enablePreloading?: boolean;
  /**
   * Should the tree group displayed element nodes by class.
   * @beta
   */
  enableElementsClassGrouping?: ClassGroupingOption;
}

/**
 * Tree which displays and manages models or categories contained in an iModel.
 * @public
 */
export function SpatialContainmentTree(props: SpatialContainmentTreeProps) {
  const { nodeLoader } = usePresentationTreeNodeLoader({
    imodel: props.iModel,
    ruleset: (!props.enableElementsClassGrouping) ? RULESET_SPATIAL_BREAKDOWN : /* istanbul ignore next */ RULESET_SPATIAL_BREAKDOWN_GROUPED_BY_CLASS,
    appendChildrenCountForGroupingNodes: (props.enableElementsClassGrouping === ClassGroupingOption.YesWithCounts),
    pagingSize: PAGING_SIZE,
    preloadingEnabled: props.enablePreloading,
  });

  const eventHandler = useDisposable(React.useCallback(() => new UnifiedSelectionTreeEventHandler({
    nodeLoader,
    collapsedChildrenDisposalEnabled: true,
  }), [nodeLoader]));
  const visibleNodes = useVisibleTreeNodes(nodeLoader.modelSource);

  return (
    <div className="ui-fw-spatial-tree">
      <ControlledTree
        visibleNodes={visibleNodes}
        nodeLoader={nodeLoader}
        treeEvents={eventHandler}
        selectionMode={SelectionMode.Extended}
      />
    </div>
  );
}

/**
 * SpatialContainmentTree that is connected to the IModelConnection property in the Redux store. The
 * application must set up the Redux store and include the FrameworkReducer.
 * @beta
 */
export const IModelConnectedSpatialContainmentTree = connectIModelConnection(null, null)(SpatialContainmentTree); // eslint-disable-line @typescript-eslint/naming-convention
