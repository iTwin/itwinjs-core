import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { MyAppFrontend } from "../../api/MyAppFrontend";
import "./IModelSelector.css";

export interface Props {
  onIModelSelected: (imodel?: IModelConnection) => void;
}

export interface State {
  availableImodels: string[];
  activeImodel?: string;
  error?: any;
}

export default class IModelSelector extends React.Component<Props, State> {

  constructor(props?: any, context?: any) {
    super(props, context);
    this.state = { availableImodels: [] };
  }

  public async componentWillMount() {
    const imodels = await MyAppFrontend.getSampleImodels();
    imodels.splice(0, 0, "");
    this.setState({ availableImodels: imodels });
  }

  // tslint:disable-next-line:naming-convention
  private onImodelSelected = async (e: any) => {
    if (MyAppFrontend.iModel) {
      MyAppFrontend.iModel.closeStandalone();
    }

    let imodel: IModelConnection | undefined;
    const imodelPath = e.target.value;
    if (!imodelPath || "" === imodelPath) {
      this.setState((prev: State) => ({ ...prev, imodel: undefined, error: undefined }));
    } else {
      try {
        imodel = await MyAppFrontend.openIModel(imodelPath);
        this.setState((prev: State) => ({ ...prev, activeImodel: imodelPath, error: undefined }));
      } catch (e) {
        this.setState((prev: State) => ({ ...prev, activeImodel: undefined, error: e }));
      }
    }
    this.props.onIModelSelected(imodel);
  }

  public render() {
    let error = null;
    if (this.state.error)
      error = (<div className="Error">{IModelApp.i18n.translate("Sample:controls.notifications.error")}: {this.state.error.message}</div>);

    return (
      <div className="IModelSelector">
        {IModelApp.i18n.translate("Sample:controls.notifications.select-imodel")}:
        <select onChange={this.onImodelSelected}>
          {this.state.availableImodels.map((path: string) => (
            <option key={path} value={path}>{path.split(/[\\/]/).pop()}</option>
          ))}
        </select>
        {error}
      </div>
    );
  }
}
