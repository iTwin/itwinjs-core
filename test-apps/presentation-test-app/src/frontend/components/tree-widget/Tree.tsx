/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./TreeWidget.css";
import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { useControlledTreeFiltering, usePresentationTreeNodeLoader, useUnifiedSelectionTreeEventHandler } from "@bentley/presentation-components";
import { ControlledTree, FilteringInput, SelectionMode, useVisibleTreeNodes } from "@bentley/ui-components";

const PAGING_SIZE = 10;

interface Props {
  imodel: IModelConnection;
  rulesetId: string;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Tree: React.FC<Props> = (props: Props) => {
  const nodeLoader = usePresentationTreeNodeLoader({
    imodel: props.imodel,
    ruleset: props.rulesetId,
    pagingSize: PAGING_SIZE,
  });

  const [filter, setFilter] = React.useState("");
  const [activeMatchIndex, setActiveMatchIndex] = React.useState(0);

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
          nodeHighlightingProps={nodeHighlightingProps}
          iconsEnabled={true}
        />
        {overlay}
      </div>
    </div>
  );
};
