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
import { Orientation } from "@bentley/ui-core";
import { PropertyGrid } from "@bentley/ui-components";
import { PresentationPropertyDataProvider, withUnifiedSelection } from "@bentley/presentation-components/lib/propertygrid";
import { IModelConnection } from "@bentley/imodeljs-frontend";

// create a HOC property grid component that supports unified selection
// tslint:disable-next-line:variable-name
const UnifiedSelectionPropertyGrid = withUnifiedSelection(PropertyGrid);

export class UnifiedSelectionPropertyGridWidgetControl extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    if (options && options.iModelConnection && options.rulesetId)
      this.reactElement = <UnifiedSelectionPropertyGridWidget iModelConnection={options.iModelConnection} rulesetId={options.rulesetId} />;
  }
}

interface UnifiedSelectionPropertyGridWidgetProps {
  iModelConnection?: IModelConnection;
  rulesetId?: string;
}

class UnifiedSelectionPropertyGridWidget extends React.Component<UnifiedSelectionPropertyGridWidgetProps> {

  public render() {
    if (this.props.iModelConnection && this.props.rulesetId)
      return <UnifiedSelectionPropertyGrid dataProvider={new PresentationPropertyDataProvider(this.props.iModelConnection, this.props.rulesetId)} orientation={Orientation.Horizontal} />;

    return null;
  }
}

ConfigurableUiManager.registerControl("UnifiedSelectionPropertyGridDemoWidget", UnifiedSelectionPropertyGridWidgetControl);
