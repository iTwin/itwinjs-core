/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import "./Nested.scss";
import classnames from "classnames";
import * as React from "react";
import { BackArrow } from "./BackArrow.js";
import { Columns } from "./Columns.js";
import { GroupProps } from "./Group.js";
import { Panel } from "./Panel.js";
import { Title } from "./Title.js";

/** Properties of [[NestedGroup]] component.
 * @alpha
 */
export interface NestedGroupProps extends GroupProps {
  /** Function called when the back arrow is clicked. */
  onBack?: () => void;
  /** Function called when pointer up event is received for back arrow. */
  onBackPointerUp?: () => void;
}

/** Nested tool group component. Used in [[ExpandableItem]] component.
 * @alpha
 */
export class NestedGroup extends React.PureComponent<NestedGroupProps> {
  public render() {
    const className = classnames(
      "nz-toolbar-item-expandable-group-nested",
      this.props.className);

    return (
      <Panel className={className} style={this.props.style}>
        <BackArrow
          className="nz-back"
          onClick={this.props.onBack}
          onPointerUp={this.props.onBackPointerUp}
        />
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
