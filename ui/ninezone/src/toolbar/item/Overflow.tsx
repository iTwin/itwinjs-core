/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";

import Icon from "./Icon";
import Expandable, { ExpandableItemProps } from "./expandable/Expandable";
import "./Overflow.scss";

export interface OverflowProps extends ExpandableItemProps {
  onClick?: () => void;
}

export default class Overflow extends React.Component<OverflowProps> {
  public render() {
    const className = classnames(
      "nz-toolbar-item-overflow",
      this.props.className);

    const { onClick, ...props } = this.props;

    return (
      <Expandable
        className={className}
        {...props}
      >
        <Icon
          className="nz-ellipsis-icon"
          onClick={onClick}
        >
          <div className="nz-ellipsis" />
        </Icon>
      </Expandable>
    );
  }
}
