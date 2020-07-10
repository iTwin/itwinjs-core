/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import { useEffect, useMemo, useState } from "react";
import { defer } from "rxjs/internal/observable/defer";
import { refCount } from "rxjs/internal/operators/refCount";
import { publish } from "rxjs/internal/operators/publish";
import { NodePathElement } from "@bentley/presentation-common";
import {
  AbstractTreeNodeLoaderWithProvider, ActiveMatchInfo, HighlightableTreeProps, ITreeNodeLoaderWithProvider, PagedTreeNodeLoader, scheduleSubscription, SubscriptionScheduler, TreeModelSource,
} from "@bentley/ui-components";
import { FilteredPresentationTreeDataProvider } from "../FilteredDataProvider";
import { IPresentationTreeDataProvider } from "../IPresentationTreeDataProvider";

const FILTERED_DATA_PAGE_SIZE = 20;

/**
 * Parameters for `useControlledTreeFiltering` hook
 * @beta
 */
export interface ControlledTreeFilteringProps {
  nodeLoader: AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider>;
  filter?: string;
  activeMatchIndex?: number;
}

/**
 * A custom hook that creates filtered model source and node loader for supplied filter.
 * If filter string is not provided or filtering is still in progress it returns supplied
 * model source and node loader.
 *
 * @note it is required for the tree to use [[IPresentationTreeDataProvider]].
 * @beta
 */
export function useControlledTreeFiltering(props: ControlledTreeFilteringProps) {
  const { filteredNodeLoader, isFiltering, matchesCount } = useFilteredNodeLoader(props.nodeLoader, props.filter);
  const nodeHighlightingProps = useNodeHighlightingProps(props.filter, filteredNodeLoader, props.activeMatchIndex);
  return {
    nodeHighlightingProps,
    filteredNodeLoader: filteredNodeLoader || props.nodeLoader,
    filteredModelSource: filteredNodeLoader ? filteredNodeLoader.modelSource : props.nodeLoader.modelSource,
    isFiltering,
    matchesCount,
  };
}

/** @internal */
export function useFilteredNodeLoader(
  nodeLoader: AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider>,
  filter: string | undefined,
) {
  const normalizedFilter = normalizeFilter(filter);
  const dataProvider = normalizeDataProvider(nodeLoader.dataProvider);
  const { nodePaths, inProgress } = useNodePaths(dataProvider, normalizedFilter);

  const { filteredProvider, matchesCount } = useMemo(() => {
    if (nodePaths !== undefined) {
      const provider = new FilteredPresentationTreeDataProvider({
        parentDataProvider: dataProvider,
        filter: normalizedFilter,
        paths: nodePaths,
      });

      return { filteredProvider: provider, matchesCount: provider.countFilteringResults(nodePaths) };
    }

    return { filteredProvider: undefined, matchesCount: undefined };
  }, [dataProvider, nodePaths, normalizedFilter]);

  const filteredNodeLoader = useMemo(() => {
    return filteredProvider ? new PagedTreeNodeLoader(filteredProvider, new TreeModelSource(), FILTERED_DATA_PAGE_SIZE) : undefined;
  }, [filteredProvider]);

  return {
    filteredNodeLoader,
    isFiltering: inProgress,
    filterApplied: filteredNodeLoader ? filteredNodeLoader.dataProvider.filter : undefined,
    matchesCount,
  };
}

const useNodePaths = (dataProvider: IPresentationTreeDataProvider, filter: string) => {
  const scheduler = useMemo(() => new SubscriptionScheduler<NodePathElement[]>(), []);

  const [nodePaths, setNodePaths] = useState<NodePathElement[]>();
  const [inProgress, setInProgress] = useState(false);

  useEffect(() => {
    if (!filter) {
      setNodePaths(undefined);
      setInProgress(false);
      return;
    }

    setInProgress(true);
    // schedule and subscribe to the observable emitting filteredNodePaths
    const subscription = defer(async () => dataProvider.getFilteredNodePaths(filter))
      .pipe(
        publish(),
        refCount(),
        scheduleSubscription(scheduler),
      )
      .subscribe({
        next: (paths) => {
          setNodePaths(paths);
          setInProgress(false);
        },
      });

    return () => { subscription.unsubscribe(); };
  }, [dataProvider, filter, scheduler]);

  return { nodePaths, inProgress };
};

/** @internal */
export function useNodeHighlightingProps(
  filter: string | undefined,
  filteredNodeLoader?: ITreeNodeLoaderWithProvider<FilteredPresentationTreeDataProvider>,
  activeMatchIndex?: number,
) {
  const [nodeHighlightingProps, setNodeHighlightingProps] = useState<HighlightableTreeProps>();
  const normalizedFilter = normalizeFilter(filter);

  useEffect(() => {
    let highlighProps: HighlightableTreeProps | undefined;
    if (normalizedFilter) {
      let activeMatch: ActiveMatchInfo | undefined;
      if (filteredNodeLoader && undefined !== activeMatchIndex)
        activeMatch = filteredNodeLoader.dataProvider.getActiveMatch(activeMatchIndex);
      highlighProps = {
        searchText: normalizedFilter,
        activeMatch,
      };
    }

    setNodeHighlightingProps(highlighProps);
  }, [normalizedFilter, filteredNodeLoader, activeMatchIndex]);

  return nodeHighlightingProps;
}

const normalizeFilter = (filter: string | undefined) => (filter ? filter : "");

const normalizeDataProvider = (dataProvider: IPresentationTreeDataProvider | FilteredPresentationTreeDataProvider) => {
  if (dataProvider instanceof FilteredPresentationTreeDataProvider) {
    return dataProvider.parentDataProvider;
  }

  return dataProvider;
};
