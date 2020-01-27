/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Id64String } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { ViewportComponent } from "@bentley/ui-components";
import { viewWithUnifiedSelection } from "@bentley/presentation-components";

// create a HOC viewport component that supports unified selection
// tslint:disable-next-line:variable-name
const SimpleViewport = viewWithUnifiedSelection(ViewportComponent);

/** React properties for the viewport component */
export interface Props {
  /** iModel whose contents should be displayed in the viewport */
  imodel: IModelConnection;
  /** View definition to use when the viewport is first loaded */
  viewDefinitionId: Id64String;
  /** ID of the presentation rule set to use for unified selection */
  rulesetId: string;
}

/** Viewport component for the viewer app */
export default class SimpleViewportComponent extends React.Component<Props> {
  public render() {
    return (
      <>
        <SimpleViewport
          imodel={this.props.imodel}
          ruleset={this.props.rulesetId}
          viewDefinitionId={this.props.viewDefinitionId}
        />
      </>
    );
  }
}
