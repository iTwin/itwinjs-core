/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";

import Panel, { PanelProps } from "./Panel";
import Columns from "./Columns";

import Title from "./Title";
import withContainIn, { WithContainInProps } from "../../../../base/WithContainIn";

export interface GroupProps extends PanelProps {
  title?: string;
}

export default class Group extends React.Component<GroupProps> {
  public render() {
    const className = classnames(
      "nz-toolbar-item-expandable-group-group",
      this.props.className);

    return (
      <Panel className={className} style={this.props.style}>
        <Title>
          {this.props.title}
        </Title>
        <Columns>
          {this.props.children}
        </Columns>
      </Panel>
    );
  }
}

// tslint:disable-next-line:variable-name
export const GroupWithContainIn: React.ComponentClass<GroupProps & WithContainInProps> = withContainIn(Group);
