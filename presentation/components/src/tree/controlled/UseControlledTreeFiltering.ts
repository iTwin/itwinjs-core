/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import { useEffect, useRef, useReducer, useState } from "react";
import * as _ from "lodash";
import { ActiveMatchInfo, HighlightableTreeProps, ITreeNodeLoaderWithProvider, PagedTreeNodeLoader, TreeModelSource, useModelSource } from "@bentley/ui-components";
import { AsyncTasksTracker } from "@bentley/presentation-common";
import { using } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { IPresentationTreeDataProvider } from "../IPresentationTreeDataProvider";
import { FilteredPresentationTreeDataProvider } from "../FilteredDataProvider";

interface FilterKey {
  imodel: IModelConnection;
  rulesetId: string;
  filter: string;
}

interface FilterState {
  inProgress?: FilterKey;
  filteredNodeLoader?: ITreeNodeLoaderWithProvider<FilteredPresentationTreeDataProvider>;
  matchesCount?: number;
}

const normalizeFilter = (filter: string | undefined) => (filter ? filter : "");
const createFilterKey = (provider: IPresentationTreeDataProvider, filter: string | undefined): FilterKey => ({
  imodel: provider.imodel,
  rulesetId: provider.rulesetId,
  filter: normalizeFilter(filter),
});
const createFilterKeyFromProvider = (provider: FilteredPresentationTreeDataProvider) => createFilterKey(provider, provider.filter);
const getActiveFilterKey = (inProgress?: FilterKey, filteredNodeLoader?: ITreeNodeLoaderWithProvider<FilteredPresentationTreeDataProvider>) => {
  return (inProgress ? inProgress : filteredNodeLoader ? createFilterKeyFromProvider(filteredNodeLoader.getDataProvider()) : undefined);
};
const normalizeDataProvider = (dataProvider: IPresentationTreeDataProvider | FilteredPresentationTreeDataProvider) => {
  if (dataProvider instanceof FilteredPresentationTreeDataProvider) {
    return dataProvider.parentDataProvider;
  }

  return dataProvider;
};

const FILTERED_DATA_PAGE_SIZE = 20;

/**
 * A custom hook that creates filtered model source and node loader for supplied filter.
 * If filter string is not provided or filtering is still in progress it returns supplied
 * model source and node loader.
 *
 * **Note:** it is required for the tree to use [[IPresentationTreeDataProvider]].
 *
 * @alpha
 */
export function useControlledTreeFiltering(
  nodeLoader: ITreeNodeLoaderWithProvider<IPresentationTreeDataProvider>,
  modelSource: TreeModelSource,
  filter: string | undefined,
  activeMatch?: number,
) {
  const {
    filteredNodeLoader,
    isFiltering,
    matchesCount,
  } = useFilteredNodeLoader(nodeLoader, filter);

  const filteredModelSource = useModelSource(filteredNodeLoader);
  const nodeHighlightingProps = useNodeHighlightingProps(filter, filteredNodeLoader, activeMatch);

  return {
    nodeHighlightingProps,
    filteredNodeLoader: filteredNodeLoader || nodeLoader,
    filteredModelSource: filteredModelSource || modelSource,
    isFiltering,
    matchesCount,
  };
}

/** @internal */
export function useFilteredNodeLoader(
  nodeLoader: ITreeNodeLoaderWithProvider<IPresentationTreeDataProvider>,
  filter: string | undefined,
) {
  const normalizedFilter = normalizeFilter(filter);
  const dataProvider = normalizeDataProvider(nodeLoader.getDataProvider());
  const lastFilter = useRef(normalizedFilter);
  if (lastFilter.current !== normalizedFilter) {
    lastFilter.current = normalizedFilter;
  }
  const asyncsTracker = useRef(new AsyncTasksTracker());
  const [{ inProgress, filteredNodeLoader, matchesCount }, setState] = useReducer(
    (state: FilterState, newState: FilterState) => ({ ...state, ...newState }),
    {});

  const loadDataProvider = async (usedFilter: string) => {
    if (asyncsTracker.current.pendingAsyncs.size > 0) {
      // avoid excessive filtering requests while previous request is still in progress
      return;
    }

    const filterBeingApplied = createFilterKey(dataProvider, usedFilter);
    const nodePaths = await using(asyncsTracker.current.trackAsyncTask(), async (_r) => {
      return dataProvider.getFilteredNodePaths(usedFilter);
    });

    const currFilter = createFilterKey(dataProvider, lastFilter.current);
    if (!_.isEqual(currFilter, filterBeingApplied)) {
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

    const filteredProvider = new FilteredPresentationTreeDataProvider(dataProvider, usedFilter, nodePaths);
    const pagedTreeNodeLoader = new PagedTreeNodeLoader(filteredProvider, FILTERED_DATA_PAGE_SIZE);

    setState({
      inProgress: undefined,
      filteredNodeLoader: pagedTreeNodeLoader,
      matchesCount: filteredProvider.countFilteringResults(nodePaths),
    });
  };

  useEffect(() => {
    if (!normalizedFilter) {
      if (inProgress || filteredNodeLoader) {
        setState({ inProgress: undefined, filteredNodeLoader: undefined, matchesCount: undefined });
      }
      return;
    }

    const candidateFilter = createFilterKey(dataProvider, normalizedFilter);
    const currFilter = getActiveFilterKey(inProgress, filteredNodeLoader);
    if (!_.isEqual(currFilter, candidateFilter)) {
      setState({ inProgress: candidateFilter });
    }
  }, [normalizedFilter, dataProvider, inProgress, filteredNodeLoader]);

  useEffect(() => {
    if (inProgress) {
      // tslint:disable-next-line:no-floating-promises
      loadDataProvider(inProgress.filter);
    }
  }, [inProgress]);

  return {
    filteredNodeLoader,
    isFiltering: !!inProgress,
    filterApplied: filteredNodeLoader ? filteredNodeLoader.getDataProvider().filter : undefined,
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
        activeMatch = filteredNodeLoader.getDataProvider().getActiveMatch(activeMatchIndex);
      highlighProps = {
        searchText: normalizedFilter,
        activeMatch,
      };
    }

    setNodeHighlightingProps(highlighProps);
  }, [normalizedFilter, filteredNodeLoader, activeMatchIndex]);

  return nodeHighlightingProps;
}
