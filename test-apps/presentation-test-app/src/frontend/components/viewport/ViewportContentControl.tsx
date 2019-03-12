/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { Id64String } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { ViewportComponent } from "@bentley/ui-components";
import { viewWithUnifiedSelection } from "@bentley/presentation-components";

// tslint:disable-next-line:variable-name naming-convention
const SampleViewport = viewWithUnifiedSelection(ViewportComponent);

export interface Props {
  imodel: IModelConnection;
  rulesetId: string;
  viewDefinitionId: Id64String;
}
export default class ViewportContentComponent extends React.Component<Props> {
  public render() {
    return (
      <SampleViewport
        imodel={this.props.imodel}
        viewDefinitionId={this.props.viewDefinitionId}
      />
    );
  }
}
