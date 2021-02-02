/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import "../WithFilteringSupport.scss";
import * as React from "react";
import { AbstractTreeNodeLoaderWithProvider } from "@bentley/ui-components";
import { IPresentationTreeDataProvider } from "../IPresentationTreeDataProvider";
import { useFilteredNodeLoader, useNodeHighlightingProps } from "./UseControlledTreeFiltering";
import { ControlledTreeWithVisibleNodesProps } from "./WithVisibleNodes";

/**
 * Props that are injected to the ControlledTreeWithFilteringSupport HOC component.
 * @beta
 * @deprecated Use hooks. Will be removed in iModel.js 3.0
 */
export interface ControlledTreeWithFilteringSupportProps {
  /** Node loader used to load nodes for tree. */
  nodeLoader: AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider>;
  /** The text to search for */
  filter?: string;
  /** Called when filter is applied. */
  onFilterApplied?: (filter: string) => void;
  /** Called when FilteredDataProvider counts the number of matches */
  onMatchesCounted?: (count: number) => void;
  /** Called when changing from original node loader to filtered and back. */
  onNodeLoaderChanged?: (nodeLoader: AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider> | undefined) => void;
  /** Index of the active match */
  activeMatchIndex?: number;
}

/**
 * A HOC component that adds filtering functionality to the supplied
 * controlled tree component.
 *
 * @note It's required for the tree to use [[PresentationTreeDataProvider]] and
 * wrap supplied tree component in [[DEPRECATED_controlledTreeWithVisibleNodes]] HOC
 *
 * @beta
 * @deprecated Use hooks. Will be removed in iModel.js 3.0
 */
// eslint-disable-next-line @typescript-eslint/naming-convention,  deprecation/deprecation
export function DEPRECATED_controlledTreeWithFilteringSupport<P extends ControlledTreeWithVisibleNodesProps>(TreeComponent: React.FC<P>) {

  type CombinedProps = P & ControlledTreeWithFilteringSupportProps; // eslint-disable-line deprecation/deprecation
  type TreeWithFilteringSupportProps = Omit<CombinedProps, "visibleNodes">;

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const TreeWithFilteringSupport: React.FC<TreeWithFilteringSupportProps> = (props: TreeWithFilteringSupportProps) => {
    const {
      nodeLoader, filter, activeMatchIndex, onFilterApplied,
      onMatchesCounted, onNodeLoaderChanged, ...strippedProps } = props;

    const {
      filteredNodeLoader,
      isFiltering,
      filterApplied,
      matchesCount,
    } = useFilteredNodeLoader(nodeLoader, filter);
    const nodeHighlightingProps = useNodeHighlightingProps(filter, filteredNodeLoader, activeMatchIndex);

    React.useEffect(() => {
      if (onFilterApplied && filterApplied !== undefined) {
        onFilterApplied(filterApplied);
      }
      if (onMatchesCounted && matchesCount !== undefined) {
        onMatchesCounted(matchesCount);
      }
    }, [onFilterApplied, filterApplied, onMatchesCounted, matchesCount]);

    React.useEffect(() => {
      if (onNodeLoaderChanged)
        onNodeLoaderChanged(filteredNodeLoader);
    }, [onNodeLoaderChanged, filteredNodeLoader]);

    const overlay = (isFiltering) ? <div className="filteredTreeOverlay" /> : undefined;

    return (
      <div className="filteredTree">
        <TreeComponent
          nodeHighlightingProps={nodeHighlightingProps}
          {...strippedProps as CombinedProps}
          nodeLoader={nodeLoader}
        />
        {overlay}
      </div>
    );
  };

  return TreeWithFilteringSupport;
}
