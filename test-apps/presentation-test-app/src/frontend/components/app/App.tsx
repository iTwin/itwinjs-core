/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Id64String } from "@bentley/bentleyjs-core";
import { ViewQueryParams } from "@bentley/imodeljs-common";
import { IModelApp, IModelConnection, PropertyRecord } from "@bentley/imodeljs-frontend";
import { DefaultContentDisplayTypes } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";
import { ElementSeparator, Orientation } from "@bentley/ui-core";
import { IPresentationTableDataProvider, IPresentationPropertyDataProvider, DataProvidersFactory } from "@bentley/presentation-components";
import IModelSelector from "../imodel-selector/IModelSelector";
import PropertiesWidget from "../properties-widget/PropertiesWidget";
import GridWidget from "../grid-widget/GridWidget";
import FindSimilarWidget from "../find-similar-widget/FindSimilarWidget";
import TreeWidget from "../tree-widget/TreeWidget";
import RulesetSelector from "../ruleset-selector/RulesetSelector";
import ViewportContentControl from "../viewport/ViewportContentControl";

import "./App.css";
import "@bentley/icons-generic-webfont/dist/bentley-icons-generic-webfont.css";

export interface State {
  imodel?: IModelConnection;
  currentRulesetId?: string;
  currentViewDefinitionId?: Id64String;
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

  public readonly state: State = {
    rightPaneRatio: 0.5,
    contentRatio: 0.7,
  };

  // tslint:disable-next-line:naming-convention
  private onIModelSelected = async (imodel: IModelConnection | undefined) => {
    const viewDefinitionId = imodel ? await this.getFirstViewDefinitionId(imodel) : undefined;
    this.setState({ ...this.state, imodel, currentViewDefinitionId: viewDefinitionId });
  }

  // tslint:disable-next-line:naming-convention
  private onRulesetSelected = (rulesetId: string | undefined) => {
    if (this.state.imodel)
      Presentation.selection.clearSelection("onRulesetChanged", this.state.imodel, 0);
    this.setState({ ...this.state, currentRulesetId: rulesetId });
  }

  private async getFirstViewDefinitionId(imodel: IModelConnection): Promise<Id64String> {
    const viewQueryParams: ViewQueryParams = { wantPrivate: false };
    const viewSpecs = await imodel.views.queryProps(viewQueryParams);
    const spatialViewSpecs = viewSpecs.filter((spec) => spec.classFullName === "BisCore:SpatialViewDefinition");
    return spatialViewSpecs.length > 0 ? spatialViewSpecs[0].id! : viewSpecs[0].id!;
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

  private _onFindSimilar = async (provider: IPresentationPropertyDataProvider, record: PropertyRecord) => {
    try {
      const factory = new DataProvidersFactory();
      const similarInstancesProvider = await factory.createSimilarInstancesTableDataProvider(provider,
        record, { displayType: DefaultContentDisplayTypes.LIST });
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

  private renderIModelComponents(imodel: IModelConnection, rulesetId: string, viewDefinitionId: Id64String) {
    return (
      <div
        className="app-content"
        ref={this._contentRef}
        style={{
          gridTemplateColumns: `${this.state.contentRatio * 100}% 1px calc(${(1 - this.state.contentRatio) * 100}% - 1px)`,
        }}>
        <div className="app-content-left">
          <div className="app-content-left-top">
            <ViewportContentControl imodel={imodel} rulesetId={rulesetId} viewDefinitionId={viewDefinitionId} />
          </div>
          <div className="app-content-left-bottom">
            {
              <GridWidget imodel={imodel} rulesetId={rulesetId} />
            }
            <div />
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
  }

  public componentDidUpdate() {
    this.afterRender();
  }

  public render() {
    let imodelComponents = null;
    if (this.state.imodel && this.state.currentRulesetId && this.state.currentViewDefinitionId)
      imodelComponents = this.renderIModelComponents(this.state.imodel, this.state.currentRulesetId, this.state.currentViewDefinitionId);

    return (
      <div className="app">
        <div className="app-header">
          <h2>{IModelApp.i18n.translate("Sample:welcome-message")}</h2>
        </div>
        <IModelSelector onIModelSelected={this.onIModelSelected} />
        <RulesetSelector availableRulesets={["Items", "Classes"]} onRulesetSelected={this.onRulesetSelected} />
        {imodelComponents}
      </div>
    );
  }
}
