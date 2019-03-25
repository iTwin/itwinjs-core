/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as classnames from "classnames";
import { IModelConnection, ViewState } from "@bentley/imodeljs-frontend";
import { AccessToken } from "@bentley/imodeljs-clients";
import { ViewsList } from "../pickers/views//ViewsList";
import { SearchBox, Timer, LoadingBar } from "@bentley/ui-core";
import { ViewDefinitionProps } from "@bentley/imodeljs-common";
import { Id64String } from "@bentley/bentleyjs-core";
import "./SheetsTab.scss";

export interface SheetsProps {
  /** IModelConnection */
  iModelConnection: IModelConnection;
  /** AccessToken */
  accessToken: AccessToken;
  /** Show sheets or saved views */
  showSheets: boolean;
  /** Callback to add optional header content */
  onAddHeader: (header: React.ReactNode) => void;
  /** Callback to allow switching tabs (not common) */
  onSetCategory: (tab: number) => void;
  /** Callback to display "loading" when entering an imodel */
  onEnter: (viewIds: Id64String[]) => void;
}

interface SheetsState {
  initialized: boolean;
  detailsView: boolean;
  filter: string;
  showPrompt: boolean;
  percent: number;
}

/**
 * SheetsTab
 */
export class SheetsTab extends React.Component<SheetsProps, SheetsState> {
  private _timer = new Timer(300);
  private static _viewsInitialized: boolean = false;

  constructor(props?: any, context?: any) {
    super(props, context);

    this.state = { initialized: false, detailsView: false, filter: "", showPrompt: false, percent: 0 };
  }

  public componentDidMount() {
    this._updateHeaderContent();
  }

  public componentWillUnmount(): void {
    this._timer.stop();
  }

  /** filter the views */
  private async _handleSearchChanged(value: string) {
    this.setState({filter: value});
  }

  /** show details or thumbnail view */
  private _onChangeView(_detailsView: boolean) {
    this.setState( { detailsView: _detailsView }, () => { this._updateHeaderContent(); } );
  }

  /* sheet has been selected */
  private _onSheetViewSelected(viewState: ViewState) {
    this.openView (viewState);
  }

  private openView(viewState: ViewState) {
    const ids: Id64String[] = [];
    ids.push (viewState.id);
    this.props.onEnter(ids);
  }

  private _updateHeaderContent() {
    const classThumbnails = classnames("viewtype icon icon-thumbnails", !this.state.detailsView && "active");
    const classDetails = classnames("viewtype icon icon-list", this.state.detailsView && "active");
    this.props.onAddHeader (
      <>
        <SearchBox placeholder="Search Views..." onValueChanged={this._handleSearchChanged.bind(this)} />
        <span className={classDetails} title="List" onClick={this._onChangeView.bind(this, true)} />
        <span className={classThumbnails} title="Thumbnails" onClick={this._onChangeView.bind(this, false)} />
      </>);
  }

  private _onViewsInitialized(views: ViewDefinitionProps[]) {
    if (!SheetsTab._viewsInitialized) {
      if (views.length === 0) {
        this.setState( {showPrompt: true }, () => {
          this._timer.setOnExecute(() => this._updatePercent!());
          this._timer.start();
        });
      }
      SheetsTab._viewsInitialized = true;
    }
  }

  private _updatePercent() {
    if (this.state.percent === 100) {
      this.props.onSetCategory(1);
    } else {
      this.setState({percent: this.state.percent + 10}, () => { this._timer.start(); });
    }
  }

  private _onRenderPrompt() {
    return (
      <div className="no-views-alert">
        <span>No saved views were found.</span>
        <br/>
        <span>Switching you to the 3D Models tab...</span>
        <LoadingBar style={{marginTop: "25px"}} barHeight={2} percent={this.state.percent} />
      </div>
    );
  }

  public render() {
    return (
      <>
        <ViewsList
          iModelConnection={this.props.iModelConnection}
          accessToken={this.props.accessToken}
          showiModelViews={true}
          showSheetViews={false}
          showThumbnails={true}
          showHoverIndicator={true}
          detailsView={this.state.detailsView}
          thumbnailViewClassName="imodelindex-thumbnailView"
          detailsViewClassName="imodelindex-detailsView"
          onViewSelected={this._onSheetViewSelected.bind(this)}
          filter={this.state.filter}
          onViewsInitialized={this._onViewsInitialized.bind(this)} />
          {this.state.showPrompt && this._onRenderPrompt()}
      </>
    );
  }
}
