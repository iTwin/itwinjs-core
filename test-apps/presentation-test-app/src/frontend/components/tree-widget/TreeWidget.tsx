/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { IPresentationTreeDataProvider, PresentationTreeDataProvider, treeWithFilteringSupport, treeWithUnifiedSelection } from "@bentley/presentation-components";
import { Tree, FilteringInput, SelectionMode, TreeNodeItem } from "@bentley/ui-components";
import "./TreeWidget.css";
import { PageOptions } from "@bentley/presentation-common";

// tslint:disable-next-line:variable-name naming-convention
const SampleTree = treeWithFilteringSupport(treeWithUnifiedSelection(Tree));

class SampleDataProvider implements IPresentationTreeDataProvider {
  private _wrapped: PresentationTreeDataProvider;
  public constructor(imodel: IModelConnection, rulesetId: string) {
    this._wrapped = new PresentationTreeDataProvider(imodel, rulesetId);
  }
  public get imodel() { return this._wrapped.imodel; }
  public get rulesetId() { return this._wrapped.rulesetId; }
  public async getNodesCount(parentNode?: TreeNodeItem) {
    const result = await this._wrapped.getNodesCount(parentNode);
    // tslint:disable-next-line:no-console
    console.log(`Total children for "${parentNode ? parentNode.label : "{root}"}": ${result}`);
    return result;
  }
  public async getNodes(parentNode?: TreeNodeItem, page?: PageOptions) {
    const result = await this._wrapped.getNodes(parentNode, page);
    result.forEach((n) => {
      n.labelItalic = true;
    });
    return result;
  }
  public getNodeKey(node: TreeNodeItem) { return this._wrapped.getNodeKey(node); }
  public async getFilteredNodePaths(filter: string) { return this._wrapped.getFilteredNodePaths(filter); }
}

export interface Props {
  imodel: IModelConnection;
  rulesetId: string;
}

export interface State {
  dataProvider: IPresentationTreeDataProvider;
  prevProps: Props;
  filter: string;
  isFiltering: boolean;
  matchesCount: number;
  activeMatchIndex: number;
}

export default class TreeWidget extends React.Component<Props, State> {

  constructor(props: Props) {
    super(props);
    this.state = {
      dataProvider: new SampleDataProvider(props.imodel, props.rulesetId),
      prevProps: props,
      filter: "",
      isFiltering: false,
      matchesCount: 0,
      activeMatchIndex: 0,
    };
  }

  public static getDerivedStateFromProps(nextProps: Props, state: State) {
    const base = { ...state, prevProps: nextProps };
    if (nextProps.imodel !== state.prevProps.imodel || nextProps.rulesetId !== state.prevProps.rulesetId)
      return { ...base, dataProvider: new SampleDataProvider(nextProps.imodel, nextProps.rulesetId) };
    return base;
  }

  // tslint:disable-next-line:naming-convention
  private onFilterApplied = (_filter?: string): void => {
    if (this.state.isFiltering)
      this.setState({ isFiltering: false });
  }

  private _onFilterStart = (filter: string) => {
    this.setState({ filter, isFiltering: true });
  }

  private _onFilterCancel = () => {
    this.setState({ filter: "", isFiltering: false });
  }

  private _onFilterClear = () => {
    this.setState({ filter: "", isFiltering: false });
  }

  private _onMatchesCounted = (count: number) => {
    if (count !== this.state.matchesCount)
      this.setState({ matchesCount: count });
  }

  private _onActiveMatchChanged = (index: number) => {
    this.setState({ activeMatchIndex: index });
  }

  private _onSelectionLoadProgress = (loaded: number, total: number) => {
    // tslint:disable-next-line:no-console
    console.log(`Loading selection: ${loaded} / ${total}`);
  }

  private _onSelectionLoadFinished = () => {
    // tslint:disable-next-line:no-console
    console.log(`Finished loading selection`);
  }

  private _onSelectionLoadCanceled = () => {
    // tslint:disable-next-line:no-console
    console.log(`Loading selection canceled`);
  }

  public render() {
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
              onSelectedChanged: this._onActiveMatchChanged,
              resultCount: this.state.matchesCount,
            }} />
        </div>
        <SampleTree dataProvider={this.state.dataProvider}
          pageSize={5} disposeChildrenOnCollapse={true}
          filter={this.state.filter}
          onFilterApplied={this.onFilterApplied}
          onMatchesCounted={this._onMatchesCounted}
          activeMatchIndex={this.state.activeMatchIndex}
          selectionMode={SelectionMode.Extended}
          onSelectionLoadProgress={this._onSelectionLoadProgress}
          onSelectionLoadCanceled={this._onSelectionLoadCanceled}
          onSelectionLoadFinished={this._onSelectionLoadFinished}
        />
      </div>
    );
  }
}
