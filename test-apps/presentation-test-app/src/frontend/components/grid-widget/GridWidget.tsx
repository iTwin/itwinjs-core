/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { PresentationTableDataProvider, tableWithUnifiedSelection, IPresentationTableDataProvider } from "@bentley/presentation-components";
import { Table } from "@bentley/ui-components";
import "./GridWidget.css";

// tslint:disable-next-line:variable-name naming-convention
const SampleTable = tableWithUnifiedSelection(Table);

export interface Props {
  imodel: IModelConnection;
  rulesetId: string;
}

export interface State {
  dataProvider: IPresentationTableDataProvider;
}

export default class GridWidget extends React.PureComponent<Props, State> {
  constructor(props: Props, context?: any) {
    super(props, context);
    this.state = { dataProvider: createDataProviderFromProps(props) };
  }
  public static getDerivedStateFromProps(props: Props, state: State): State | null {
    const needsDataProviderRecreated = (props.imodel !== state.dataProvider.imodel || props.rulesetId !== state.dataProvider.rulesetId);
    if (needsDataProviderRecreated)
      state.dataProvider = createDataProviderFromProps(props);
    return state;
  }
  public componentWillUnmount() {
    this.state.dataProvider.dispose();
  }
  public componentDidUpdate(_prevProps: Props, prevState: State) {
    if (this.state.dataProvider !== prevState.dataProvider)
      prevState.dataProvider.dispose();
  }
  public render() {
    return (
      <div className="gridwidget">
        <h3>{IModelApp.i18n.translate("Sample:controls.grid")}</h3>
        <div className="gridwidget-content">
          <SampleTable dataProvider={this.state.dataProvider} />
        </div>
      </div>
    );
  }
}

const createDataProviderFromProps = (props: Props) => new PresentationTableDataProvider({ imodel: props.imodel, ruleset: props.rulesetId });
