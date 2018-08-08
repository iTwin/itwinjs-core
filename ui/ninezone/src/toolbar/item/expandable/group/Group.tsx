/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import withContainIn, { WithContainInProps } from "../../../../base/WithContainIn";
import Panel from "./Panel";
import Columns from "./Columns";
import Title from "./Title";
import CommonProps, { NoChildrenProps } from "../../../../utilities/Props";

/** Properties of [[Group]] component. */
export interface GroupProps extends CommonProps, NoChildrenProps {
  /** Tool group title. */
  title?: string;
  /** Columns of tool group. I.e. [[Column]]  */
  columns?: React.ReactNode;
}

/** Tool group component. Used in [[ExpandableItem]] component.  */
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
          {this.props.columns}
        </Columns>
      </Panel>
    );
  }
}

// tslint:disable-next-line:variable-name
export const GroupWithContainIn: React.ComponentClass<GroupProps & WithContainInProps> = withContainIn(Group);
