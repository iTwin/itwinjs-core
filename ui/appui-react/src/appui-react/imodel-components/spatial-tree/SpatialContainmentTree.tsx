/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelComponents
 */

import "./SpatialContainmentTree.scss";
import * as React from "react";
import { IModelConnection } from "@itwin/core-frontend";
import { Ruleset } from "@itwin/presentation-common";
import { UnifiedSelectionTreeEventHandler, usePresentationTreeNodeLoader } from "@itwin/presentation-components";
import { ControlledTree, SelectionMode, useTreeModel } from "@itwin/components-react";
import { useDisposable } from "@itwin/core-react";
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
  /** Width of the component */
  width: number;
  /** Height of the component */
  height: number;
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
  });

  const eventHandler = useDisposable(React.useCallback(() => new UnifiedSelectionTreeEventHandler({
    nodeLoader,
    collapsedChildrenDisposalEnabled: true,
  }), [nodeLoader]));
  const treeModel = useTreeModel(nodeLoader.modelSource);

  return (
    <div className="ui-fw-spatial-tree">
      <ControlledTree
        model={treeModel}
        nodeLoader={nodeLoader}
        eventsHandler={eventHandler}
        selectionMode={SelectionMode.Extended}
        width={props.width}
        height={props.height}
      />
    </div>
  );
}
