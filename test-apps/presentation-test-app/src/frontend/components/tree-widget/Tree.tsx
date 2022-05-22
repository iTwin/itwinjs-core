/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./TreeWidget.css";
import React from "react";
import { IModelConnection } from "@itwin/core-frontend";
import {
  DiagnosticsProps, useControlledPresentationTreeFiltering, usePresentationTreeNodeLoader, useUnifiedSelectionTreeEventHandler,
} from "@itwin/presentation-components";
import { ControlledTree, SelectionMode, useTreeModel } from "@itwin/components-react";

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
  width: number;
  height: number;
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
  const treeModel = useTreeModel(filteredModelSource);

  return (
    <ControlledTree
      model={treeModel}
      eventsHandler={eventHandler}
      nodeLoader={filteredNodeLoader}
      selectionMode={SelectionMode.Extended}
      nodeHighlightingProps={nodeHighlightingProps}
      iconsEnabled={true}
      width={props.width}
      height={props.height}
    />
  );
}
