/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  ControlledTree,
  SelectionMode,
  FilteringInput,
  ITreeNodeLoaderWithProvider,
  TreeEventHandler,
  TreeModelSource,
  PagedTreeNodeLoader,
  createModelSourceForNodeLoader,
} from "@bentley/ui-components";

import { IModelConnection, IModelApp } from "@bentley/imodeljs-frontend";
import {
  IPresentationTreeDataProvider,
  controlledTreeWithFilteringSupport,
  controlledTreeWithUnifiedSelection,
  controlledTreeWithModelSource,
} from "@bentley/presentation-components";

import * as React from "react";
import "./TreeWidget.css";
import { SampleDataProvider, PAGING_SIZE } from "./SampleTreeDataProvider";

// tslint:disable-next-line: variable-name
const PresentationTree = controlledTreeWithUnifiedSelection(controlledTreeWithFilteringSupport(controlledTreeWithModelSource(ControlledTree)));

export interface Props {
  imodel: IModelConnection;
  rulesetId: string;

  children?: never;
}

export interface State {
  nodeLoader: ITreeNodeLoaderWithProvider<IPresentationTreeDataProvider>;
  modelSource: TreeModelSource;
  filteredNodeLoader?: ITreeNodeLoaderWithProvider<IPresentationTreeDataProvider>;
  filteredModelSource?: TreeModelSource;
  prevProps: Props;
  filter: string;
  isFiltering: boolean;
  matchesCount: number;
  activeMatchIndex: number;
}

export default class ControlledTreeWithHOCs extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    const nodeLoader = new PagedTreeNodeLoader(new SampleDataProvider(props.imodel, props.rulesetId), PAGING_SIZE);
    const { modelSource } = createModelSourceForNodeLoader(nodeLoader);

    this.state = {
      nodeLoader,
      modelSource,
      prevProps: props,
      filter: "",
      isFiltering: false,
      matchesCount: 0,
      activeMatchIndex: 0,
    };
  }

  public static getDerivedStateFromProps(nextProps: Props, state: State) {
    const base = { ...state, prevProps: nextProps };
    if (nextProps.imodel !== state.prevProps.imodel || nextProps.rulesetId !== state.prevProps.rulesetId) {
      const nodeLoader = new PagedTreeNodeLoader(new SampleDataProvider(nextProps.imodel, nextProps.rulesetId), PAGING_SIZE);
      const { modelSource } = createModelSourceForNodeLoader(nodeLoader);
      return { ...base, nodeLoader, modelSource };
    }
    return base;
  }

  private _onFilterApplied = () => {
    this.setState((prevState) => ({ ...prevState, isFiltering: false }));
  }

  private _onMatchesCounted = (count: number) => {
    this.setState((prevState) => ({ ...prevState, matchesCount: count }));
  }

  private _onNodeLoaderChanged = (loader: ITreeNodeLoaderWithProvider<IPresentationTreeDataProvider> | undefined) => {
    if (!loader) {
      this.setState((prevState) => ({ ...prevState, filteredNodeLoader: undefined, filteredModelSource: undefined }));
      return;
    }
    const { modelSource } = createModelSourceForNodeLoader(loader);

    this.setState((prevState) => ({ ...prevState, filteredNodeLoader: loader, filteredModelSource: modelSource }));
  }

  private _onFilterCancel = () => {
    this.setState((prevState) => ({ ...prevState, isFiltering: false, filter: "" }));
  }

  private _onFilterClear = () => {
    this.setState((prevState) => ({ ...prevState, isFiltering: false, filter: "" }));
  }

  private _onFilterStart = (filter: string) => {
    this.setState((prevState) => ({ ...prevState, isFiltering: true, filter }));
  }

  private _onActiveMatchIndexChange = (index: number) => {
    this.setState((prevState) => ({ ...prevState, activeMatchIndex: index }));
  }

  public render() {
    const eventHandler = new TreeEventHandler({
      modelSource: this.state.filteredModelSource || this.state.modelSource,
      nodeLoader: this.state.filteredNodeLoader || this.state.nodeLoader,
      collapsedChildrenDisposalEnabled: true,
    });

    return (
      <div className="treewidget">
        <div className="treewidget-header">
          <h3>{IModelApp.i18n.translate("Sample:controls.tree")}</h3>
          <FilteringInput
            filteringInProgress={this.state.isFiltering}
            onFilterCancel={this._onFilterCancel}
            onFilterClear={this._onFilterClear}
            onFilterStart={this._onFilterStart}
            resultSelectorProps={{
              onSelectedChanged: this._onActiveMatchIndexChange,
              resultCount: this.state.matchesCount,
            }} />
        </div>
        <PresentationTree
          modelSource={this.state.filteredModelSource || this.state.modelSource}
          treeEvents={eventHandler}
          nodeLoader={this.state.filteredNodeLoader || this.state.nodeLoader}
          selectionMode={SelectionMode.Extended}
          descriptionsEnabled={true}
          filter={this.state.filter}
          onFilterApplied={this._onFilterApplied}
          onMatchesCounted={this._onMatchesCounted}
          onNodeLoaderChanged={this._onNodeLoaderChanged}
          activeMatchIndex={this.state.activeMatchIndex}
        />
      </div>
    );
  }
}
