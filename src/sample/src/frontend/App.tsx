import * as React from "react";
import { IModelToken } from "@bentley/imodeljs-frontend/lib/common/IModel";
import IModelSelector from "./components/IModelSelector/IModelSelector";
import PropertiesWidget from "./components/PropertiesWidget/PropertiesWidget";

import "./App.css";

export interface State {
  imodelToken?: IModelToken;
}

export default class App extends React.Component<{}, State> {

  constructor(props?: any, context?: any) {
    super(props, context);
    this.state = {};
  }

  // tslint:disable-next-line:naming-convention
  private onIModelSelected = (imodelToken: IModelToken | undefined) => {
    this.setState({ imodelToken });
  }

  private renderIModelComponents(imodelToken: IModelToken) {
    return (
      <div className="Content">
        <PropertiesWidget imodelToken={imodelToken} />
      </div>
    );
  }

  public render() {
    let imodelComponents = null;
    if (this.state.imodelToken)
      imodelComponents = this.renderIModelComponents(this.state.imodelToken);

    return (
      <div className="App">
        <div className="Header">
          <h2>Welcome to ECPresentation sample app</h2>
        </div>
        <IModelSelector onIModelSelected={this.onIModelSelected} />
        {imodelComponents}
      </div>
    );
  }
}
