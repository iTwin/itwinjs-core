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
import { usePresentationNodeLoader, useControlledTreeUnifiedSelection, useRulesetRegistration, IPresentationTreeDataProvider } from "@bentley/presentation-components";
import { ControlledTree, TreeEventHandler, useVisibleTreeNodes, SelectionMode } from "@bentley/ui-components";

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

  const eventHandler = React.useMemo(() => new TreeEventHandler({ modelSource, nodeLoader, collapsedChildrenDisposalEnabled: true }), [modelSource, nodeLoader]);
  const unifiedSelectionHandler = useControlledTreeUnifiedSelection(modelSource, eventHandler, nodeLoader.getDataProvider());

  const visibleNodes = useVisibleTreeNodes(modelSource);

  return (
    <div className="uifw-spatial-tree">
      <ControlledTree
        visibleNodes={visibleNodes}
        nodeLoader={nodeLoader}
        treeEvents={unifiedSelectionHandler}
        selectionMode={SelectionMode.None}
      />
    </div>
  );
};
