import * as React from "react";
import { IModelConnection } from "@bentley/imodeljs-frontend/lib/frontend/IModelConnection";
import { MyAppFrontend } from "../../api/MyAppFrontend";

import "./IModelSelector.css";

export interface Props {
  onIModelSelected: (imodel?: IModelConnection) => void;
}

export interface State {
  imodel?: IModelConnection;
  error?: any;
}

export default class IModelSelector extends React.Component<Props, State> {

  public static readonly DEFAULT_IMODEL_ID = "a783226f-835b-4559-b175-3e8102faa561";

  private _imodelIdInput: HTMLInputElement | null = null;

  constructor(props?: any, context?: any) {
    super(props, context);
    this.state = {};
  }

  // tslint:disable-next-line:naming-convention
  private onIModelIdChange = async (e: any) => {
    const imodelId = e.target.value;
    try {
      await MyAppFrontend.openIModel(imodelId);
      if (MyAppFrontend.iModel)
        this.setState({ error: undefined, imodel: MyAppFrontend.iModel });
      else
        this.setState({ error: undefined, imodel: undefined });
    } catch (e) {
      this.setState({ imodel: undefined, error: e });
    } finally {
      this.props.onIModelSelected(MyAppFrontend.iModel);
    }
  }

  // tslint:disable-next-line:naming-convention
  private onUseButtonClicked = () => {
    if (!this._imodelIdInput)
      return;

    this._imodelIdInput!.value = IModelSelector.DEFAULT_IMODEL_ID;
    this.onIModelIdChange({ target: this._imodelIdInput });
  }

  public render() {
    let error = null;
    if (this.state.error)
      error = (<div className="Error">Error: {this.state.error.message}</div>);

    return (
      <div className="IModelSelector">
        Enter an iModel ID: <input onChange={this.onIModelIdChange} ref={(input) => { this._imodelIdInput = input; }} />
        <code> (Hint: try <b>{IModelSelector.DEFAULT_IMODEL_ID}</b>) </code>
        <button onClick={this.onUseButtonClicked}>Use</button>
        {error}
      </div>
    );
  }
}
