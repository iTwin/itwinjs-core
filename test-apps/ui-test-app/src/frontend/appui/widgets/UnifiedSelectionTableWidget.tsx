/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import {
  ConfigurableUiManager,
  ConfigurableCreateInfo,
  WidgetControl,
} from "@bentley/ui-framework";
import { Table } from "@bentley/ui-components";
import { PresentationTableDataProvider, tableWithUnifiedSelection } from "@bentley/presentation-components";
import { IModelConnection } from "@bentley/imodeljs-frontend";

// create a HOC property grid component that supports unified selection
// tslint:disable-next-line:variable-name
const UnifiedSelectionTable = tableWithUnifiedSelection(Table);

export class UnifiedSelectionTableWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    if (options && options.iModelConnection && options.rulesetId)
      this.reactElement = <UnifiedSelectionTableWidget iModelConnection={options.iModelConnection} rulesetId={options.rulesetId} />;
  }
}

interface UnifiedSelectionTableWidgetProps {
  iModelConnection?: IModelConnection;
  rulesetId?: string;
}

interface UnifiedSelectionTableWidgetState {
  dataProvider: PresentationTableDataProvider;
}

class UnifiedSelectionTableWidget extends React.PureComponent<UnifiedSelectionTableWidgetProps, UnifiedSelectionTableWidgetState> {
  constructor(props: UnifiedSelectionTableWidgetProps, context?: any) {
    super(props, context);
    this.state = { dataProvider: createDataProviderFromProps(props) };
  }
  public static getDerivedStateFromProps(props: UnifiedSelectionTableWidgetProps, state: UnifiedSelectionTableWidgetState): UnifiedSelectionTableWidgetState | null {
    const needsDataProviderRecreated = (props.iModelConnection !== state.dataProvider.imodel || props.rulesetId !== state.dataProvider.rulesetId);
    if (needsDataProviderRecreated)
      state.dataProvider = createDataProviderFromProps(props);
    return state;
  }
  public componentWillUnmount() {
    this.state.dataProvider.dispose();
  }
  public componentDidUpdate(_prevProps: UnifiedSelectionTableWidgetProps, prevState: UnifiedSelectionTableWidgetState) {
    if (this.state.dataProvider !== prevState.dataProvider)
      prevState.dataProvider.dispose();
  }
  public render() {
    if (this.props.iModelConnection && this.props.rulesetId) {
      return (
        <div style={{ height: "100%" }}>
          <UnifiedSelectionTable dataProvider={this.state.dataProvider} />
        </div>
      );
    }
    return null;
  }
}

const createDataProviderFromProps = (props: UnifiedSelectionTableWidgetProps) =>
  new PresentationTableDataProvider({ imodel: props.iModelConnection!, ruleset: props.rulesetId! });

ConfigurableUiManager.registerControl("UnifiedSelectionTableDemoWidget", UnifiedSelectionTableWidgetControl);
