/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import {
  ConfigurableUiManager,
  ConfigurableCreateInfo,
  WidgetControl,
} from "@bentley/ui-framework";
import { Table } from "@bentley/ui-components";
import { PresentationTableDataProvider, withUnifiedSelection } from "@bentley/presentation-components/lib/table";
import { IModelConnection } from "@bentley/imodeljs-frontend";

// create a HOC property grid component that supports unified selection
// tslint:disable-next-line:variable-name
const UnifiedSelectionTable = withUnifiedSelection(Table);

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

class UnifiedSelectionTableWidget extends React.Component<UnifiedSelectionTableWidgetProps> {

  public render() {
    if (this.props.iModelConnection && this.props.rulesetId) {
      return (
        <div style={{ height: "100%" }}>
          <UnifiedSelectionTable dataProvider={new PresentationTableDataProvider(this.props.iModelConnection, this.props.rulesetId)} />
        </div>
      );
    }

    return null;
  }
}

ConfigurableUiManager.registerControl("UnifiedSelectionTableDemoWidget", UnifiedSelectionTableWidgetControl);
