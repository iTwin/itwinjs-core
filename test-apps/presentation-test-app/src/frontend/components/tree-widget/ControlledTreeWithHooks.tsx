/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import {
  ControlledTree,
  usePagedNodeLoader,
  SelectionMode,
  FilteringInput,
  TreeEventHandler,
  useModelSource,
  useVisibleTreeNodes,
} from "@bentley/ui-components";

import { IModelConnection, IModelApp } from "@bentley/imodeljs-frontend";
import {
  useControlledTreeUnifiedSelection, useControlledTreeFiltering,
} from "@bentley/presentation-components";

import * as React from "react";
// tslint:disable-next-line: no-duplicate-imports
import { useState, useMemo } from "react";

import "./TreeWidget.css";
import { useDataProvider, PAGING_SIZE } from "./SampleTreeDataProvider";

interface Props {
  imodel: IModelConnection;
  rulesetId: string;
}

// tslint:disable-next-line: variable-name
export const ControlledTreeWithHooks: React.FC<Props> = (props: Props) => {
  const dataProvider = useDataProvider(props.imodel, props.rulesetId);
  const nodeLoader = usePagedNodeLoader(dataProvider, PAGING_SIZE);
  const modelSource = useModelSource(nodeLoader)!;

  const [filter, setFilter] = useState("");
  const [activeMatch, setActiveMatch] = useState(0);

  const {
    filteredModelSource,
    filteredNodeLoader,
    isFiltering,
    matchesCount,
    nodeHighlightingProps,
  } = useControlledTreeFiltering(nodeLoader, modelSource, filter, activeMatch);

  const eventHandler = useMemo(() => new TreeEventHandler({
    modelSource: filteredModelSource,
    nodeLoader: filteredNodeLoader,
    collapsedChildrenDisposalEnabled: true,
  }), [filteredNodeLoader, filteredModelSource]);

  const unifiedSelectionHandler = useControlledTreeUnifiedSelection(filteredModelSource, eventHandler, dataProvider);
  const visibleNodes = useVisibleTreeNodes(filteredModelSource);

  const overlay = isFiltering ? <div className="filteredTreeOverlay" /> : null;

  return (
    <div className="treewidget">
      <div className="treewidget-header">
        <h3>{IModelApp.i18n.translate("Sample:controls.tree")}</h3>
        <FilteringInput
          filteringInProgress={isFiltering}
          onFilterCancel={() => { setFilter(""); }}
          onFilterClear={() => { setFilter(""); }}
          onFilterStart={(newFilter) => { setFilter(newFilter); }}
          resultSelectorProps={{
            onSelectedChanged: (index) => setActiveMatch(index),
            resultCount: matchesCount || 0,
          }} />
      </div>
      <div className="filteredTree">
        <ControlledTree
          visibleNodes={visibleNodes}
          treeEvents={unifiedSelectionHandler}
          nodeLoader={filteredNodeLoader}
          selectionMode={SelectionMode.Extended}
          descriptionsEnabled={true}
          nodeHighlightingProps={nodeHighlightingProps}
        />
        {overlay}
      </div>
    </div>
  );
};
