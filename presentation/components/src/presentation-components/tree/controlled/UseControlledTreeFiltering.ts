/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import { isEqual } from "lodash";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { using } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { AsyncTasksTracker } from "@bentley/presentation-common";
import {
  AbstractTreeNodeLoaderWithProvider, ActiveMatchInfo, HighlightableTreeProps, ITreeNodeLoaderWithProvider, PagedTreeNodeLoader, TreeModelSource,
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
  const lastFilter = useRef(normalizedFilter);
  if (lastFilter.current !== normalizedFilter) {
    lastFilter.current = normalizedFilter;
  }
  const asyncsTracker = useRef(new AsyncTasksTracker());
  const [{ inProgress, filteredNodeLoader, matchesCount }, setState] = useReducer(
    (state: FilterState, newState: FilterState) => ({ ...state, ...newState }),
    {});

  const loadDataProvider = useCallback(async (usedFilter: string) => {
    if (asyncsTracker.current.pendingAsyncs.size > 0) {
      // avoid excessive filtering requests while previous request is still in progress
      return;
    }

    const filterBeingApplied = createFilterKey(dataProvider, usedFilter);
    const nodePaths = await using(asyncsTracker.current.trackAsyncTask(), async (_r) => {
      return dataProvider.getFilteredNodePaths(usedFilter);
    });

    const currFilter = createFilterKey(dataProvider, lastFilter.current);
    if (!isEqual(currFilter, filterBeingApplied)) {
      if (currFilter.filter) {
        // the filter has changed while we were waiting for `getFilteredNodePaths` result - need
        // to restart the load
        setState({ inProgress: currFilter });
      } else {
        // the filter has been cleared while we were waiting for `getFilteredNodePaths` result - the
        // state should already be cleared so we can just return
      }
      return;
    }

    const filteredProvider = new FilteredPresentationTreeDataProvider({
      parentDataProvider: dataProvider,
      filter: usedFilter,
      paths: nodePaths,
    });
    const modelSource = new TreeModelSource();
    const pagedTreeNodeLoader = new PagedTreeNodeLoader(filteredProvider, modelSource, FILTERED_DATA_PAGE_SIZE);

    setState({
      inProgress: undefined,
      filteredNodeLoader: pagedTreeNodeLoader,
      matchesCount: filteredProvider.countFilteringResults(nodePaths),
    });
  }, [dataProvider]);

  useEffect(() => {
    if (!normalizedFilter) {
      if (inProgress || filteredNodeLoader) {
        setState({ inProgress: undefined, filteredNodeLoader: undefined, matchesCount: undefined });
      }
      return;
    }

    const candidateFilter = createFilterKey(dataProvider, normalizedFilter);
    const currFilter = getActiveFilterKey(inProgress, filteredNodeLoader);
    if (!isEqual(currFilter, candidateFilter)) {
      setState({ inProgress: candidateFilter });
    }
  }, [normalizedFilter, dataProvider, inProgress, filteredNodeLoader]);

  useEffect(() => {
    if (inProgress) {
      // tslint:disable-next-line:no-floating-promises
      loadDataProvider(inProgress.filter);
    }
  }, [loadDataProvider, inProgress]);

  return {
    filteredNodeLoader,
    isFiltering: !!inProgress,
    filterApplied: filteredNodeLoader ? filteredNodeLoader.dataProvider.filter : undefined,
    matchesCount,
  };
}

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

interface FilterKey {
  imodel: IModelConnection;
  rulesetId: string;
  filter: string;
}

interface FilterState {
  inProgress?: FilterKey;
  filteredNodeLoader?: AbstractTreeNodeLoaderWithProvider<FilteredPresentationTreeDataProvider>;
  matchesCount?: number;
}

const normalizeFilter = (filter: string | undefined) => (filter ? filter : "");
const createFilterKey = (provider: IPresentationTreeDataProvider, filter: string | undefined): FilterKey => ({
  imodel: provider.imodel,
  rulesetId: provider.rulesetId,
  filter: normalizeFilter(filter),
});
const createFilterKeyFromProvider = (provider: FilteredPresentationTreeDataProvider) => createFilterKey(provider, provider.filter);
const getActiveFilterKey = (inProgress?: FilterKey, filteredNodeLoader?: AbstractTreeNodeLoaderWithProvider<FilteredPresentationTreeDataProvider>) => {
  return (inProgress ? inProgress : filteredNodeLoader ? createFilterKeyFromProvider(filteredNodeLoader.dataProvider) : undefined);
};
const normalizeDataProvider = (dataProvider: IPresentationTreeDataProvider | FilteredPresentationTreeDataProvider) => {
  if (dataProvider instanceof FilteredPresentationTreeDataProvider) {
    return dataProvider.parentDataProvider;
  }

  return dataProvider;
};
