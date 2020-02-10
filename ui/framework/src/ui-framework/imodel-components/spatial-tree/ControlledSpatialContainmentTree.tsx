/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelComponents
 */

import * as React from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Ruleset } from "@bentley/presentation-common";
import { usePresentationNodeLoader, useRulesetRegistration, IPresentationTreeDataProvider, UnifiedSelectionTreeEventHandler } from "@bentley/presentation-components";
import { ControlledTree, useVisibleTreeNodes, SelectionMode } from "@bentley/ui-components";
import { useDisposable } from "@bentley/ui-core";

const PAGING_SIZE = 20;
/** Presentation rules used by ControlledSpatialContainmentTree
 * @internal
 */
export const RULESET: Ruleset = require("./SpatialBreakdown.json"); // tslint:disable-line: no-var-requires

/**
 * Properties for the [[ControlledSpatialContainmentTree]] component
 * @internal
 */
export interface ControlledSpatialContainmentTreeProps {
  iModel: IModelConnection;
  /**
   * Start loading hierarchy as soon as the component is created
   */
  enablePreloading?: boolean;
  /**
   * Used for testing
   */
  dataProvider?: IPresentationTreeDataProvider;
}

/**
 * Tree which displays and manages models or categories contained in an iModel.
 * @internal
 */
// tslint:disable-next-line:variable-name naming-convention
export const ControlledSpatialContainmentTree: React.FC<ControlledSpatialContainmentTreeProps> = (props: ControlledSpatialContainmentTreeProps) => {
  useRulesetRegistration(RULESET);
  const nodeLoader = usePresentationNodeLoader({
    imodel: props.iModel,
    rulesetId: RULESET.id,
    pageSize: PAGING_SIZE,
    preloadingEnabled: props.enablePreloading,
    dataProvider: props.dataProvider,
  });
  const modelSource = nodeLoader.modelSource;

  const createEventHandler = React.useCallback(() => new UnifiedSelectionTreeEventHandler({
    modelSource,
    nodeLoader,
    dataProvider: nodeLoader.getDataProvider(),
    collapsedChildrenDisposalEnabled: true,
  }), [modelSource, nodeLoader]);
  const eventHandler = useDisposable(createEventHandler);

  const visibleNodes = useVisibleTreeNodes(modelSource);

  return (
    <div className="uifw-spatial-tree">
      <ControlledTree
        visibleNodes={visibleNodes}
        nodeLoader={nodeLoader}
        treeEvents={eventHandler}
        selectionMode={SelectionMode.None}
      />
    </div>
  );
};
