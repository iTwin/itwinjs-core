/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { PresentationTableDataProvider, tableWithUnifiedSelection } from "@bentley/presentation-components";
import { Table } from "@bentley/ui-components";
import "./GridWidget.css";

// tslint:disable-next-line:variable-name naming-convention
const SampleTable = tableWithUnifiedSelection(Table);

export interface Props {
  imodel: IModelConnection;
  rulesetId: string;
}

export default class GridWidget extends React.Component<Props> {
  constructor(props: Props, context?: any) {
    super(props, context);
    this.state = {};
  }
  public render() {
    return (
      <div className="gridwidget">
        <h3>{IModelApp.i18n.translate("Sample:controls.grid")}</h3>
        <div className="gridwidget-content">
          <SampleTable dataProvider={new PresentationTableDataProvider(this.props.imodel, this.props.rulesetId)} />
        </div>
      </div>
    );
  }
}
