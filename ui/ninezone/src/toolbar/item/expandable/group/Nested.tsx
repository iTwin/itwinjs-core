/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import withContainIn, { WithContainInProps } from "../../../../base/WithContainIn";
import Panel from "./Panel";
import { GroupProps } from "./Group";
import Columns from "./Columns";
import Title from "./Title";
import BackArrow from "./BackArrow";
import "./Nested.scss";

/** Properties of [[NestedGroup]] component. */
export interface NestedGroupProps extends GroupProps {
  /** Function called when the back arrow is clicked. */
  onBack?: () => void;
}

/** Nested tool group component. Used in [[ExpandableItem]] component. */
export default class NestedGroup extends React.Component<NestedGroupProps> {
  public render() {
    const className = classnames(
      "nz-toolbar-item-expandable-group-nested",
      this.props.className);

    return (
      <Panel className={className} style={this.props.style}>
        <div
          className="nz-back-arrow-container"
          onClick={this.props.onBack}
        >
          <BackArrow />
        </div>
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
export const NestedWithContainIn: React.ComponentClass<NestedGroupProps & WithContainInProps> = withContainIn(NestedGroup);
