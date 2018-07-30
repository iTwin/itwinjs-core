/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps from "../../../../utilities/Props";

import "./Panel.scss";
import withContainIn, { WithContainInProps } from "../../../../base/WithContainIn";

export interface PanelProps extends CommonProps {
  title?: string;
}

export default class Panel extends React.Component<PanelProps> {
  public render() {
    const className = classnames(
      "nz-toolbar-item-expandable-group-panel",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        {this.props.children}
      </div>
    );
  }
}

// tslint:disable-next-line:variable-name
export const PanelWithContainIn: React.ComponentClass<PanelProps & WithContainInProps> = withContainIn(Panel);
