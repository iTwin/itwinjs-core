/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tree
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { of } from "rxjs";
import { Observable } from "rxjs/internal/Observable";
import {
  AbstractTreeNodeLoaderWithProvider, ActiveMatchInfo, HighlightableTreeProps, ITreeNodeLoaderWithProvider, LoadedNodeHierarchy, PagedTreeNodeLoader,
  TreeModelSource, useDebouncedAsyncValue,
} from "@itwin/components-react";
import { FilteredPresentationTreeDataProvider, IFilteredPresentationTreeDataProvider } from "../FilteredDataProvider";
import { IPresentationTreeDataProvider } from "../IPresentationTreeDataProvider";

const FILTERED_DATA_PAGE_SIZE = 20;

class FilteringInProgressNodeLoader extends AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider> {
  constructor(dataProvider: IPresentationTreeDataProvider) {
    super(new TreeModelSource(), dataProvider);
  }

  protected load(): Observable<LoadedNodeHierarchy> {
    const loadedNodeHierarchy: LoadedNodeHierarchy = {
      hierarchyItems: [],
      offset: 0,
      parentId: "",
    };
    return of(loadedNodeHierarchy);
  }
}

/**
 * Parameters for [[useControlledPresentationTreeFiltering]] hook
 * @public
 */
export interface ControlledPresentationTreeFilteringProps {
  nodeLoader: AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider>;
  filter?: string;
  activeMatchIndex?: number;
}

/**
 * A custom hook that creates filtered model source and node loader for supplied filter.
 * If filter string is not provided or filtering is still in progress it returns supplied
 * model source and node loader.
 *
 * @public
 */
export function useControlledPresentationTreeFiltering(props: ControlledPresentationTreeFilteringProps) {
  const { filteredNodeLoader, isFiltering, matchesCount } = useFilteredNodeLoader(props.nodeLoader, props.filter);
  const filteringInProgressNodeLoader = useMemo(() => {
    return isFiltering ? new FilteringInProgressNodeLoader(props.nodeLoader.dataProvider) : undefined;
  }, [isFiltering, props.nodeLoader.dataProvider]);
  const nodeHighlightingProps = useNodeHighlightingProps(props.filter, filteredNodeLoader, props.activeMatchIndex);
  return {
    nodeHighlightingProps,
    filteredNodeLoader: filteredNodeLoader || filteringInProgressNodeLoader || props.nodeLoader,
    filteredModelSource: filteredNodeLoader?.modelSource || filteringInProgressNodeLoader?.modelSource || props.nodeLoader.modelSource,
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
  const { value: nodePaths, inProgress } = useNodePaths(dataProvider, normalizedFilter);

  const { filteredProvider, matchesCount } = useMemo(() => {
    if (nodePaths !== undefined) {
      const provider: IFilteredPresentationTreeDataProvider = new FilteredPresentationTreeDataProvider({
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
  const getFilteredNodePaths = useCallback(async () => dataProvider.getFilteredNodePaths(filter), [dataProvider, filter]);
  return useDebouncedAsyncValue(filter ? getFilteredNodePaths : undefined);
};

/** @internal */
export function useNodeHighlightingProps(
  filter: string | undefined,
  filteredNodeLoader?: ITreeNodeLoaderWithProvider<IFilteredPresentationTreeDataProvider>,
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
