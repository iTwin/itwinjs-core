import * as React from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend/lib/IModelConnection";
import { TreeNodeItem } from "@bentley/ecpresentation-frontend/lib/Controls/TreeDataProvider";
import IModelSelector from "../IModelSelector/IModelSelector";
import PropertiesWidget from "../PropertiesWidget/PropertiesWidget";
import GridWidget from "../GridWidget/GridWidget";
import TreeWidget from "../TreeWidget/TreeWidget";

import "./App.css";

export interface State {
  imodel?: IModelConnection;
  currentRulesetId?: string;
  selectedNodes: TreeNodeItem[];
}

export default class App extends React.Component<{}, State> {

  constructor(props?: any, context?: any) {
    super(props, context);
    this.state = { selectedNodes: [] };
  }

  // tslint:disable-next-line:naming-convention
  private onIModelSelected = (imodel: IModelConnection | undefined) => {
    this.setState({ imodel });
  }

  // tslint:disable-next-line:naming-convention
  private onTreeNodesSelected = (nodes: TreeNodeItem[], rulesetId: string | undefined) => {
    this.setState({ ...this.state, selectedNodes: nodes, currentRulesetId: rulesetId });
  }

  private renderIModelComponents(imodel: IModelConnection) {
    return (
      <div className="Content">
        <div className="Content-Top">
        <TreeWidget imodel={imodel} onTreeNodesSelected={this.onTreeNodesSelected} />
          <PropertiesWidget imodel={imodel} rulesetId={this.state.currentRulesetId} selectedNodes={this.state.selectedNodes} />
        </div>
        <div className="Content-Bottom">
          <GridWidget imodel={imodel} rulesetId={this.state.currentRulesetId} selectedNodes={this.state.selectedNodes} />
        </div>
      </div>
    );
  }

  public render() {
    let imodelComponents = null;
    if (this.state.imodel)
      imodelComponents = this.renderIModelComponents(this.state.imodel);

    return (
      <div className="App">
        <div className="Header">
          <h2>Welcome to ECPresentation Sample App</h2>
        </div>
        <IModelSelector onIModelSelected={this.onIModelSelected} />
        {imodelComponents}
      </div>
    );
  }
}
