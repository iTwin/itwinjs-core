import * as React from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend/lib/frontend/IModelConnection";
import IModelSelector from "../IModelSelector/IModelSelector";
import PropertiesWidget from "../PropertiesWidget/PropertiesWidget";

import "./App.css";

export interface State {
  imodel?: IModelConnection;
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

  private renderIModelComponents(imodel: IModelConnection) {
    return (
      <div className="Content">
        <PropertiesWidget imodel={imodel} />
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
