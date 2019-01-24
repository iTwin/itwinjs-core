/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { tableWithUnifiedSelection, IPresentationTableDataProvider } from "@bentley/presentation-components";
import { Table } from "@bentley/ui-components";
import "./FindSimilarWidget.css";

// tslint:disable-next-line:variable-name naming-convention
const SampleTable = tableWithUnifiedSelection(Table);

export interface Props {
  dataProvider: IPresentationTableDataProvider;
  onDismissed?: () => void;
}

export default class FindSimilarWidget extends React.PureComponent<Props> {
  constructor(props: Props, context?: any) {
    super(props, context);
    this.state = { prevProps: props };
  }
  public componentWillUnmount() {
    this.props.dataProvider.dispose();
  }
  public componentDidUpdate(prevProps: Props) {
    if (this.props.dataProvider !== prevProps.dataProvider)
      prevProps.dataProvider.dispose();
  }
  private _onDismissClicked = () => {
    if (this.props.onDismissed)
      this.props.onDismissed();
  }
  public render() {
    return (
      <div className="find-similar-widget">
        <div className="find-similar-header">
          <h3>{IModelApp.i18n.translate("Sample:controls.find-similar.results")}</h3>
          <button onClick={this._onDismissClicked}>
            {IModelApp.i18n.translate("Sample:controls.find-similar.dismiss-button.label")}
          </button>
        </div>
        <div className="find-similar-widget-content">
          <SampleTable dataProvider={this.props.dataProvider} selectionLevel={0} />
        </div>
      </div>
    );
  }
}
