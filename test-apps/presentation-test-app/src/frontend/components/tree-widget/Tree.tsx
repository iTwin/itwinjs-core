/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./TreeWidget.css";
import React from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import {
  DiagnosticsProps, useControlledPresentationTreeFiltering, usePresentationTreeNodeLoader, useUnifiedSelectionTreeEventHandler,
} from "@bentley/presentation-components";
import { ControlledTree, SelectionMode, useVisibleTreeNodes } from "@bentley/ui-components";

const PAGING_SIZE = 10;

interface Props {
  imodel: IModelConnection;
  rulesetId: string;
  diagnostics: DiagnosticsProps;
  filtering: {
    filter: string;
    activeMatchIndex: number;
    onFilteringStateChange: (isFiltering: boolean, matchesCount: number | undefined) => void;
  };
}

export function Tree(props: Props) {
  const { nodeLoader } = usePresentationTreeNodeLoader({
    imodel: props.imodel,
    ruleset: props.rulesetId,
    pagingSize: PAGING_SIZE,
    ...props.diagnostics,
  });

  const {
    filteredModelSource,
    filteredNodeLoader,
    isFiltering,
    matchesCount,
    nodeHighlightingProps,
  } = useControlledPresentationTreeFiltering({ nodeLoader, filter: props.filtering.filter, activeMatchIndex: props.filtering.activeMatchIndex });

  const { onFilteringStateChange } = props.filtering;
  React.useEffect(() => {
    onFilteringStateChange(isFiltering, matchesCount);
  }, [isFiltering, matchesCount, onFilteringStateChange]);

  const eventHandler = useUnifiedSelectionTreeEventHandler({ nodeLoader: filteredNodeLoader, collapsedChildrenDisposalEnabled: true, name: "TreeWithHooks" });
  const visibleNodes = useVisibleTreeNodes(filteredModelSource);

  return (
    <ControlledTree
      visibleNodes={visibleNodes}
      treeEvents={eventHandler}
      nodeLoader={filteredNodeLoader}
      selectionMode={SelectionMode.Extended}
      nodeHighlightingProps={nodeHighlightingProps}
      iconsEnabled={true}
    />
  );
}
