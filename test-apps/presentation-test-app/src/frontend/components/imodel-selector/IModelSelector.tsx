/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./IModelSelector.css";
import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { MyAppFrontend } from "../../api/MyAppFrontend";

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

  public async componentWillMount() { // eslint-disable-line react/no-deprecated
    const imodels = await MyAppFrontend.getSampleImodels();
    imodels.splice(0, 0, "");
    this.setState({ availableImodels: imodels });
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  private onImodelSelected = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const imodelPath = e.currentTarget.value;
    if (MyAppFrontend.iModel) {
      await MyAppFrontend.iModel.close();
    }

    let imodel: IModelConnection | undefined;
    if (!imodelPath || "" === imodelPath) {
      this.setState((prev: State) => ({ ...prev, imodel: undefined, error: undefined }));
    } else {
      try {
        imodel = await MyAppFrontend.openIModel(imodelPath);
        this.setState((prev: State) => ({ ...prev, activeImodel: imodelPath, error: undefined }));
      } catch (err) {
        this.setState((prev: State) => ({ ...prev, activeImodel: undefined, error: err }));
      }
    }
    this.props.onIModelSelected(imodel);
  };

  public render() {
    let error = null;
    if (this.state.error)
      error = (<div className="Error">{IModelApp.i18n.translate("Sample:controls.notifications.error")}: {this.state.error.message}</div>);

    return (
      <div className="IModelSelector">
        {IModelApp.i18n.translate("Sample:controls.notifications.select-imodel")}:
        {/* eslint-disable-next-line jsx-a11y/no-onchange */}
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
