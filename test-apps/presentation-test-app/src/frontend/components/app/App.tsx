/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { PropertyRecord } from "@bentley/ui-abstract";
import { DefaultContentDisplayTypes } from "@bentley/presentation-common";
import { Presentation, SelectionChangeEventArgs } from "@bentley/presentation-frontend";
import { ElementSeparator, Orientation } from "@bentley/ui-core";
import { IPresentationTableDataProvider, IPresentationPropertyDataProvider, DataProvidersFactory } from "@bentley/presentation-components";
import IModelSelector from "../imodel-selector/IModelSelector";
import PropertiesWidget from "../properties-widget/PropertiesWidget";
import GridWidget from "../grid-widget/GridWidget";
import FindSimilarWidget from "../find-similar-widget/FindSimilarWidget";
import RulesetSelector from "../ruleset-selector/RulesetSelector";
import ViewportContentControl from "../viewport/ViewportContentControl";
import { TreeWidget } from "../tree-widget/TreeWidget";

import "./App.css";
import "@bentley/icons-generic-webfont/dist/bentley-icons-generic-webfont.css";

export interface State {
  imodel?: IModelConnection;
  currentRulesetId?: string;
  rightPaneRatio: number;
  rightPaneHeight?: number;
  contentRatio: number;
  contentWidth?: number;
  similarInstancesProvider?: IPresentationTableDataProvider;
}

export default class App extends React.Component<{}, State> {
  private readonly _minRightPaneRatio = 0.3;
  private readonly _maxRightPaneRatio = 0.7;
  private readonly _minContentRatio = 0.2;
  private readonly _maxContentRatio = 0.9;
  private _rightPaneRef = React.createRef<HTMLDivElement>();
  private _contentRef = React.createRef<HTMLDivElement>();
  private _selectionListener!: () => void;

  public readonly state: State = {
    rightPaneRatio: 0.5,
    contentRatio: 0.7,
  };

  // tslint:disable-next-line:naming-convention
  private onIModelSelected = async (imodel: IModelConnection | undefined) => {
    this.tryPreloadHierarchy(imodel, this.state.currentRulesetId);
    this.setState({ imodel });
  }

  // tslint:disable-next-line:naming-convention
  private onRulesetSelected = (rulesetId: string | undefined) => {
    if (this.state.imodel)
      Presentation.selection.clearSelection("onRulesetChanged", this.state.imodel, 0);

    this.tryPreloadHierarchy(this.state.imodel, rulesetId);

    this.setState({ currentRulesetId: rulesetId });
  }

  private tryPreloadHierarchy(imodel: IModelConnection | undefined, rulesetId: string | undefined) {
    if (!imodel || !rulesetId)
      return;

    // no need to wait on this - we just want to queue a request and forget it
    // tslint:disable-next-line:no-floating-promises
    Presentation.presentation.loadHierarchy({ imodel, rulesetOrId: rulesetId });
  }

  private _onTreePaneRatioChanged = (ratio: number) => {
    if (ratio < this._minRightPaneRatio)
      ratio = this._minRightPaneRatio;
    if (ratio > this._maxRightPaneRatio)
      ratio = this._maxRightPaneRatio;
    this.setState({ rightPaneRatio: ratio });
  }

  private _onContentRatioChanged = (ratio: number) => {
    if (ratio < this._minContentRatio)
      ratio = this._minContentRatio;
    if (ratio > this._maxContentRatio)
      ratio = this._maxContentRatio;
    this.setState({ contentRatio: ratio });
  }

  private _selectAllInstances = async (provider: IPresentationTableDataProvider) => {
    const size = await provider.getRowsCount();
    const rowPromises = [];
    for (let i = 0; i < size; ++i)
      rowPromises.push(provider.getRow(i));
    const rows = await Promise.all(rowPromises);
    const keys = rows.map((r) => provider.getRowKey(r!));
    Presentation.selection.addToSelection("app", provider.imodel, keys);
  }

  private _onFindSimilar = async (provider: IPresentationPropertyDataProvider, record: PropertyRecord) => {
    try {
      const factory = new DataProvidersFactory();
      const similarInstancesProvider = await factory.createSimilarInstancesTableDataProvider(provider,
        record, { displayType: DefaultContentDisplayTypes.List });
      await this._selectAllInstances(similarInstancesProvider);
      this.setState({ similarInstancesProvider });
    } catch (e) {
      console.log(e); // tslint:disable-line:no-console
      alert(`Can't find similar instances for the selected property`);
      this.setState({ similarInstancesProvider: undefined });
    }
  }

  private _onSimilarInstancesResultsDismissed = () => {
    this.setState({ similarInstancesProvider: undefined });
  }

  private _onSelectionChanged = async (args: SelectionChangeEventArgs) => {
    if (!IModelApp.viewManager.selectedView) {
      // no viewport to zoom in
      return;
    }

    if (args.source === "Tool") {
      // selection originated from the viewport - don't change what it's displaying by zooming in
      return;
    }

    // determine what the viewport is hiliting
    const hiliteSet = await Presentation.selection.getHiliteSet(args.imodel);
    if (hiliteSet.elements) {
      // note: the hilite list may contain models and subcategories as well - we don't
      // care about them at this moment
      await IModelApp.viewManager.selectedView.zoomToElements(hiliteSet.elements);
    }
  }

  private renderIModelComponents(imodel: IModelConnection, rulesetId: string) {
    return (
      <div
        className="app-content"
        ref={this._contentRef}
        style={{
          gridTemplateColumns: `${this.state.contentRatio * 100}% 1px calc(${(1 - this.state.contentRatio) * 100}% - 1px)`,
        }}>
        <div className="app-content-left">
          <div className="app-content-left-top">
            <ViewportContentControl imodel={imodel} />
          </div>
          <div className="app-content-left-bottom">
            {
              <GridWidget imodel={imodel} rulesetId={rulesetId} />
            }
            {
              this.state.similarInstancesProvider ?
                <FindSimilarWidget dataProvider={this.state.similarInstancesProvider} onDismissed={this._onSimilarInstancesResultsDismissed} />
                : undefined
            }
          </div>
        </div>
        <ElementSeparator
          orientation={Orientation.Horizontal}
          ratio={this.state.contentRatio}
          movableArea={this.state.contentWidth}
          separatorSize={10}
          onRatioChanged={this._onContentRatioChanged}
        />
        <div
          ref={this._rightPaneRef}
          className="app-content-right"
          style={{
            gridTemplateRows: `${this.state.rightPaneRatio * 100}% 30px calc(${(1 - this.state.rightPaneRatio) * 100}% - 30px)`,
          }}>
          <TreeWidget imodel={imodel} rulesetId={rulesetId} />
          <div className="app-content-right-separator">
            <hr />
            <ElementSeparator
              orientation={Orientation.Vertical}
              ratio={this.state.rightPaneRatio}
              movableArea={this.state.rightPaneHeight}
              onRatioChanged={this._onTreePaneRatioChanged} />
          </div>
          <PropertiesWidget imodel={imodel} rulesetId={rulesetId} onFindSimilar={this._onFindSimilar} />
        </div>
      </div>
    );
  }

  private afterRender() {
    if (this._rightPaneRef.current) {
      const height = this._rightPaneRef.current.getBoundingClientRect().height;
      if (height !== this.state.rightPaneHeight)
        this.setState({ rightPaneHeight: height });
    }
    if (this._contentRef.current) {
      const width = this._contentRef.current.getBoundingClientRect().width;
      if (width !== this.state.contentWidth)
        this.setState({ contentWidth: width });
    }
  }

  public componentDidMount() {
    this.afterRender();
    this._selectionListener = Presentation.selection.selectionChange.addListener(this._onSelectionChanged);
  }

  public componentDidUpdate() {
    this.afterRender();
  }

  public componentWillUnmount() {
    Presentation.selection.selectionChange.removeListener(this._selectionListener);
  }

  public render() {
    let imodelComponents = null;
    if (this.state.imodel && this.state.currentRulesetId)
      imodelComponents = this.renderIModelComponents(this.state.imodel, this.state.currentRulesetId);

    return (
      <div className="app">
        <div className="app-header">
          <h2>{IModelApp.i18n.translate("Sample:welcome-message")}</h2>
        </div>
        <IModelSelector onIModelSelected={this.onIModelSelected} />
        <RulesetSelector onRulesetSelected={this.onRulesetSelected} />
        {imodelComponents}
      </div>
    );
  }
}
