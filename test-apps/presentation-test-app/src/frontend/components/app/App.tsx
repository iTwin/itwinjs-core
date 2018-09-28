import * as React from "react";
import { Id64String } from "@bentley/bentleyjs-core";
import { ViewQueryParams } from "@bentley/imodeljs-common";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { Presentation } from "@bentley/presentation-frontend";
import IModelSelector from "../imodel-selector/IModelSelector";
import PropertiesWidget from "../properties-widget/PropertiesWidget";
import GridWidget from "../grid-widget/GridWidget";
import TreeWidget from "../tree-widget/TreeWidget";
import RulesetSelector from "../ruleset-selector/RulesetSelector";
import ViewportContentControl from "../viewport/ViewportContentControl";
import "./App.css";

export interface State {
  imodel?: IModelConnection;
  currentRulesetId?: string;
  currentViewDefinitionId?: Id64String;
}

export default class App extends React.Component<{}, State> {

  constructor(props?: any, context?: any) {
    super(props, context);
    this.state = {};
  }

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

  private renderIModelComponents(imodel: IModelConnection, rulesetId: string, viewDefinitionId: Id64String) {
    return (
      <div className="app-content">
        <div className="content-left">
          <div className="content-left-top">
            <ViewportContentControl imodel={imodel} rulesetId={rulesetId} viewDefinitionId={viewDefinitionId} />
          </div>
          <div className="content-left-bottom">
            <GridWidget imodel={imodel} rulesetId={rulesetId} />
          </div>
        </div>
        <div className="content-right">
          <TreeWidget imodel={imodel} rulesetId={rulesetId} />
          <PropertiesWidget imodel={imodel} rulesetId={rulesetId} />
        </div>
      </div>
    );
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
