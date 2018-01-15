import * as React from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend/lib/frontend/IModelConnection";
import { TreeNodeItem } from "@bentley/ecpresentation-frontend/lib/frontend/Controls/TreeDataProvider";
import IModelSelector from "../IModelSelector/IModelSelector";
import PropertiesWidget from "../PropertiesWidget/PropertiesWidget";
import TreeWidget from "../TreeWidget/TreeWidget";

import "./App.css";

export interface State {
  imodel?: IModelConnection;
  selectedNode?: TreeNodeItem;
}

export default class App extends React.Component<{}, State> {

  constructor(props?: any, context?: any) {
    super(props, context);
    this.state = {};
  }

  // tslint:disable-next-line:naming-convention
  private onIModelSelected = (imodel: IModelConnection | undefined) => {
    this.setState({ imodel });
  }

  // tslint:disable-next-line:naming-convention
  private onTreeNodeSelected = (node?: TreeNodeItem) => {
    this.setState({ ...this.state, selectedNode: node });
  }

  private renderIModelComponents(imodel: IModelConnection) {
    return (
      <div className="Content">
        <TreeWidget imodel={imodel} onTreeNodeSelected={this.onTreeNodeSelected} />
        <PropertiesWidget imodel={imodel} selectedNode={this.state.selectedNode} />
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
