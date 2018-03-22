import * as React from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import IModelSelector from "../IModelSelector/IModelSelector";
import PropertiesWidget from "../PropertiesWidget/PropertiesWidget";
import GridWidget from "../GridWidget/GridWidget";
import TreeWidget from "../TreeWidget/TreeWidget";
import RulesetSelector from "../RulesetSelector/RulesetSelector";
import { SelectionManager, SelectionManagerImpl } from "@bentley/ecpresentation-frontend/lib/Selection";
import "./App.css";

export interface State {
  imodel?: IModelConnection;
  currentRulesetId?: string;
}

export default class App extends React.Component<{}, State> {

  private _selectionManager: SelectionManager;
  constructor(props?: any, context?: any) {
    super(props, context);
    this.state = {};
    this._selectionManager = new SelectionManagerImpl();
  }

  // tslint:disable-next-line:naming-convention
  private onIModelSelected = (imodel: IModelConnection | undefined) => {
    this.setState({ ...this.state, imodel });
  }

  // tslint:disable-next-line:naming-convention
  private onBeforeCloseImodel = (imodel: IModelConnection) => {
    this._selectionManager.clearSelection("onImodelSelected", imodel.iModelToken, 0);
  }

  // tslint:disable-next-line:naming-convention
  private onRulesetSelected = (rulesetId: string | undefined) => {
    if (this.state.imodel)
      this._selectionManager.clearSelection("onRulesetChanged", this.state.imodel.iModelToken, 0);
    this.setState({ ...this.state, currentRulesetId: rulesetId });
  }

  private renderIModelComponents(imodel: IModelConnection, rulesetId: string) {
    return (
      <div className="Content">
        <div className="Content-Top">
          <TreeWidget imodel={imodel} rulesetId={rulesetId} selectionManager={this._selectionManager} />
          <PropertiesWidget imodel={imodel} rulesetId={rulesetId} selectionManager={this._selectionManager} />
        </div>
        <div className="Content-Bottom">
          <GridWidget imodel={imodel} rulesetId={rulesetId} selectionManager={this._selectionManager} />
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
          <h2>Welcome to ECPresentation Sample App</h2>
        </div>
        <IModelSelector onIModelSelected={this.onIModelSelected} onBeforeCloseImodel={this.onBeforeCloseImodel} />
        <RulesetSelector availableRulesets={["Items", "Classes"]} onRulesetSelected={this.onRulesetSelected} />
        {imodelComponents}
      </div>
    );
  }
}
