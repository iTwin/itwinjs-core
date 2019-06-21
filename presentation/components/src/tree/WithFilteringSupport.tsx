/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as React from "react";
import * as _ from "lodash";
import { TreeProps, ActiveMatchInfo, HighlightableTreeProps } from "@bentley/ui-components";
import { getDisplayName } from "../common/Utils";
import { IPresentationTreeDataProvider } from "./IPresentationTreeDataProvider";
import { FilteredPresentationTreeDataProvider } from "./FilteredDataProvider";
import "./WithFilteringSupport.scss";
import { AsyncTasksTracker } from "@bentley/presentation-common";
import { using } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";

/**
 * Props that are injected to the TreeWithFilteringSupport HOC component.
 * @public
 */
export interface TreeWithFilteringSupportProps {
  /** The text to search for */
  filter?: string;
  /** The data provider used by the tree. */
  dataProvider: IPresentationTreeDataProvider;
  /** Called when filter is applied. */
  onFilterApplied?: (filter: string, filteredProvider: IPresentationTreeDataProvider) => void;
  /** Called when FilteredDataProvider counts the number of matches */
  onMatchesCounted?: (count: number) => void;
  /** Index of the active match */
  activeMatchIndex?: number;
}

/**
 * A HOC component that adds filtering functionality to the supplied
 * tree component.
 *
 * **Note:** it is required for the tree to use [[IPresentationTreeDataProvider]]
 *
 * @public
 */
// tslint:disable-next-line: variable-name naming-convention
export function treeWithFilteringSupport<P extends TreeProps>(TreeComponent: React.ComponentType<P>): React.ComponentType<P & TreeWithFilteringSupportProps> {

  type CombinedProps = P & TreeWithFilteringSupportProps;

  interface FilterKey {
    imodel: IModelConnection;
    rulesetId: string;
    filter: string;
  }

  interface State {
    inProgress?: FilterKey;
    filteredDataProvider?: FilteredPresentationTreeDataProvider;
  }

  const normalizeFilter = (filter: string | undefined) => (filter ? filter : "");

  const createFilterKey = (provider: IPresentationTreeDataProvider, filter: string | undefined): FilterKey => ({
    imodel: provider.imodel,
    rulesetId: provider.rulesetId,
    filter: normalizeFilter(filter),
  });

  const createFilterKeyFromProvider = (provider: FilteredPresentationTreeDataProvider) => createFilterKey(provider, provider.filter);

  const getActiveFilterKey = (state: State) => (state.inProgress ? state.inProgress : state.filteredDataProvider ? createFilterKeyFromProvider(state.filteredDataProvider) : undefined);

  return class WithFilteringSupport extends React.PureComponent<CombinedProps, State> {

    private _asyncsTracker = new AsyncTasksTracker();

    public static get displayName() { return `WithFilteringSupport(${getDisplayName(TreeComponent)})`; }

    public constructor(props: CombinedProps, context?: any) {
      super(props, context);
      this.state = {};
    }

    public get pendingAsyncs() { return this._asyncsTracker.pendingAsyncs; }

    public componentDidUpdate() {
      if (!normalizeFilter(this.props.filter)) {
        this.setState((prev) => {
          if (prev.inProgress || prev.filteredDataProvider)
            return { inProgress: undefined, filteredDataProvider: undefined };
          return null;
        });
        return;
      }

      const currFilter = getActiveFilterKey(this.state);
      const candidateFilter = createFilterKey(this.props.dataProvider, this.props.filter);
      if (!_.isEqual(currFilter, candidateFilter)) {
        this.setState({ inProgress: candidateFilter }, () => {
          // tslint:disable-next-line: no-floating-promises
          this.loadDataProvider(candidateFilter.filter);
        });
      }
    }

    public componentDidMount() {
      const filter = normalizeFilter(this.props.filter);
      if (filter) {
        this.setState({ inProgress: createFilterKey(this.props.dataProvider, filter) }, () => {
          // tslint:disable-next-line: no-floating-promises
          this.loadDataProvider(filter);
        });
      }
    }

    private async loadDataProvider(filter: string) {
      if (this._asyncsTracker.pendingAsyncs.size > 0) {
        // avoid excessive filtering requests while previous request is still in progress
        return;
      }

      const filterBeingApplied = createFilterKey(this.props.dataProvider, filter);
      const nodePaths = await using(this._asyncsTracker.trackAsyncTask(), async (_r) => {
        return this.props.dataProvider.getFilteredNodePaths(filter);
      });

      const currFilter = createFilterKey(this.props.dataProvider, this.props.filter);
      if (!_.isEqual(currFilter, filterBeingApplied)) {
        if (currFilter.filter) {
          // the filter has changed while we were waiting for `getFilteredNodePaths` result - need
          // to restart the load
          await this.loadDataProvider(currFilter.filter);
        } else {
          // the filter has been cleared while we were waiting for `getFilteredNodePaths` result - the
          // state should already be cleared so we can just return
        }
        return;
      }

      const filteredDataProvider = new FilteredPresentationTreeDataProvider(this.props.dataProvider, filter, nodePaths);
      this.setState({ inProgress: undefined, filteredDataProvider }, () => {
        // istanbul ignore else
        if (this.props.onFilterApplied)
          this.props.onFilterApplied(filter, filteredDataProvider);
        // istanbul ignore else
        if (this.props.onMatchesCounted)
          this.props.onMatchesCounted(filteredDataProvider.countFilteringResults(nodePaths));
      });
    }

    public render() {
      const {
        filter, dataProvider, onFilterApplied, onMatchesCounted, activeMatchIndex,
        ...props
      } = this.props as any;

      const overlay = (this.state.inProgress) ? <div className="filteredTreeOverlay" /> : undefined;

      let nodeHighlightingProps: HighlightableTreeProps | undefined;
      if (filter) {
        let activeMatch: ActiveMatchInfo | undefined;
        if (this.state.filteredDataProvider && undefined !== activeMatchIndex)
          activeMatch = this.state.filteredDataProvider.getActiveMatch(activeMatchIndex);
        nodeHighlightingProps = {
          searchText: filter,
          activeMatch,
        };
      }

      return (
        <div className="filteredTree">
          <TreeComponent
            dataProvider={this.state.filteredDataProvider ? this.state.filteredDataProvider : this.props.dataProvider}
            nodeHighlightingProps={nodeHighlightingProps}
            {...props}
          />
          {overlay}
        </div>
      );
    }

  };
}
