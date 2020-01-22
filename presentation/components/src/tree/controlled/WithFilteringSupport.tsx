/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import * as React from "react";
import { ITreeNodeLoaderWithProvider } from "@bentley/ui-components";
import { IPresentationTreeDataProvider } from "../IPresentationTreeDataProvider";
import { useNodeHighlightingProps, useFilteredNodeLoader } from "./UseControlledTreeFiltering";
import { ControlledTreeWithModelSourceProps } from "./WithModelSource";
import "../WithFilteringSupport.scss";

/**
 * Props that are injected to the ControlledTreeWithFilteringSupport HOC component.
 * @beta
 */
export interface ControlledTreeWithFilteringSupportProps {
  /** Node loader used to load nodes for tree. */
  nodeLoader: ITreeNodeLoaderWithProvider<IPresentationTreeDataProvider>;
  /** The text to search for */
  filter?: string;
  /** Called when filter is applied. */
  onFilterApplied?: (filter: string) => void;
  /** Called when FilteredDataProvider counts the number of matches */
  onMatchesCounted?: (count: number) => void;
  /** Called when changing from original node loader to filtered and back. */
  onNodeLoaderChanged?: (nodeLoader: ITreeNodeLoaderWithProvider<IPresentationTreeDataProvider> | undefined) => void;
  /** Index of the active match */
  activeMatchIndex?: number;
}

/**
 * A HOC component that adds filtering functionality to the supplied
 * controlled tree component.
 *
 * **Note:** it is required for the tree to use [[PresentationTreeDataProvider]] and
 * wrap supplied tree component in [[controlledTreeWithModelSource]] HOC
 *
 * @beta
 */
// tslint:disable-next-line: variable-name naming-convention
export function controlledTreeWithFilteringSupport<P extends ControlledTreeWithModelSourceProps>(TreeComponent: React.FC<P>) {

  type CombinedProps = P & ControlledTreeWithFilteringSupportProps;
  type TreeWithFilteringSupportProps = Omit<CombinedProps, "visibleNodes">;

  // tslint:disable-next-line: variable-name naming-convention
  const treeWithFilteringSupport: React.FC<TreeWithFilteringSupportProps> = (props: TreeWithFilteringSupportProps) => {
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
    }, [filterApplied, matchesCount]);

    React.useEffect(() => {
      if (onNodeLoaderChanged)
        onNodeLoaderChanged(filteredNodeLoader);
    }, [filteredNodeLoader]);

    const overlay = (isFiltering) ? <div className="filteredTreeOverlay" /> : undefined;

    return (
      <div className="filteredTree">
        <TreeComponent
          nodeLoader={nodeLoader}
          nodeHighlightingProps={nodeHighlightingProps}
          {...strippedProps as CombinedProps}
        />
        {overlay}
      </div>
    );
  };

  return treeWithFilteringSupport;
}
