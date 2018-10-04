/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { Id64String } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { ViewportComponent } from "@bentley/ui-components";
import { withUnifiedSelection } from "@bentley/presentation-components/lib/viewport";

// tslint:disable-next-line:variable-name naming-convention
const SampleViewport = withUnifiedSelection(ViewportComponent);

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
        rulesetId={this.props.rulesetId}
        viewDefinitionId={this.props.viewDefinitionId}
      />
    );
  }
}
