import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { ECPresentation } from "@bentley/ecpresentation-frontend";
import IModelSelector from "../imodel-selector/IModelSelector";
import PropertiesWidget from "../properties-widget/PropertiesWidget";
import GridWidget from "../grid-widget/GridWidget";
import TreeWidget from "../tree-widget/TreeWidget";
import RulesetSelector from "../ruleset-selector/RulesetSelector";
import "./App.css";

export interface State {
  imodel?: IModelConnection;
  currentRulesetId?: string;
}

export default class App extends React.Component<{}, State> {

  constructor(props?: any, context?: any) {
    super(props, context);
    this.state = {};
  }

  // tslint:disable-next-line:naming-convention
  private onIModelSelected = (imodel: IModelConnection | undefined) => {
    this.setState({ ...this.state, imodel });
  }

  // tslint:disable-next-line:naming-convention
  private onRulesetSelected = (rulesetId: string | undefined) => {
    if (this.state.imodel)
      ECPresentation.selection.clearSelection("onRulesetChanged", this.state.imodel, 0);
    this.setState({ ...this.state, currentRulesetId: rulesetId });
  }

  private renderIModelComponents(imodel: IModelConnection, rulesetId: string) {
    return (
      <div className="Content">
        <div className="Content-Top">
          <TreeWidget imodel={imodel} rulesetId={rulesetId} />
          <PropertiesWidget imodel={imodel} rulesetId={rulesetId} />
        </div>
        <div className="Content-Bottom">
          <GridWidget imodel={imodel} rulesetId={rulesetId} />
        </div>
      </div>
    );
  }

  public render() {
    let imodelComponents = null;
    if (this.state.imodel && this.state.currentRulesetId)
      imodelComponents = this.renderIModelComponents(this.state.imodel, this.state.currentRulesetId);

    return (
      <div className="App">
        <div className="Header">
          <h2>{IModelApp.i18n.translate("Sample:welcome-message")}</h2>
        </div>
        <IModelSelector onIModelSelected={this.onIModelSelected} />
        <RulesetSelector availableRulesets={["Items", "Classes"]} onRulesetSelected={this.onRulesetSelected} />
        {imodelComponents}
      </div>
    );
  }
}
