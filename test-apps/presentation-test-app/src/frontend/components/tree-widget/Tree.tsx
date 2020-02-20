/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  ControlledTree,
  usePagedTreeNodeLoader,
  SelectionMode,
  FilteringInput,
  useTreeModelSource,
  useVisibleTreeNodes,
} from "@bentley/ui-components";

import { IModelConnection, IModelApp } from "@bentley/imodeljs-frontend";
import {
  useControlledTreeFiltering, useUnifiedSelectionTreeEventHandler,
} from "@bentley/presentation-components";

import * as React from "react";
// tslint:disable-next-line: no-duplicate-imports
import { useState } from "react";

import "./TreeWidget.css";
import { useDataProvider, PAGING_SIZE } from "./SampleTreeDataProvider";

interface Props {
  imodel: IModelConnection;
  rulesetId: string;
}

// tslint:disable-next-line: variable-name
export const Tree: React.FC<Props> = (props: Props) => {
  const dataProvider = useDataProvider(props.imodel, props.rulesetId);
  const modelSource = useTreeModelSource(dataProvider);
  const nodeLoader = usePagedTreeNodeLoader(dataProvider, PAGING_SIZE, modelSource);

  const [filter, setFilter] = useState("");
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  const {
    filteredModelSource,
    filteredNodeLoader,
    isFiltering,
    matchesCount,
    nodeHighlightingProps,
  } = useControlledTreeFiltering({ nodeLoader, filter, activeMatchIndex });
  const eventHandler = useUnifiedSelectionTreeEventHandler({ nodeLoader: filteredNodeLoader ?? nodeLoader, collapsedChildrenDisposalEnabled: true, name: "TreeWithHooks" });
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
            onSelectedChanged: (index) => setActiveMatchIndex(index),
            resultCount: matchesCount || 0,
          }} />
      </div>
      <div className="filteredTree">
        <ControlledTree
          visibleNodes={visibleNodes}
          treeEvents={eventHandler}
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
