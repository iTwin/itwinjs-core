import * as React from "react";
import { IModelToken } from "@bentley/imodeljs-frontend/lib/common/IModel";
import { MyAppFrontend } from "../../api/MyAppFrontend";

import "./IModelSelector.css";

export interface Props {
  onIModelSelected: (imodelToken?: IModelToken) => void;
}

export interface State {
  imodelToken?: IModelToken;
  error?: any;
}

export default class IModelSelector extends React.Component<Props, State> {

  public static readonly DEFAULT_IMODEL_ID = "02d587b8-6d14-4af9-9194-2c4a4a3fd88e";

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
        this.setState({ error: undefined, imodelToken: MyAppFrontend.iModel.iModelToken });
      else
        this.setState({ error: undefined, imodelToken: undefined });
    } catch (e) {
      this.setState({ imodelToken: undefined, error: e });
    } finally {
      this.props.onIModelSelected(MyAppFrontend.iModel ? MyAppFrontend.iModel.iModelToken : undefined);
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
