/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { PropertyGrid} from "@itwin/components-react";
import { Orientation } from "@itwin/core-react";

import { FeatureInfoDataProvider } from "./FeatureInfoDataProvider";

export class FeatureInfoWidget extends React.Component {
  private _dataProvider: FeatureInfoDataProvider;

  constructor(props: any) {
    super(props);

    this._dataProvider = new FeatureInfoDataProvider();
  }

  public override render() {
    return (
      <PropertyGrid dataProvider={this._dataProvider} orientation={Orientation.Vertical} isPropertySelectionEnabled={true} />
    );
  }
}

// ConfigurableUiManager.registerControl("VerticalPropertyGridDemoWidget", VerticalPropertyGridWidgetControl);
