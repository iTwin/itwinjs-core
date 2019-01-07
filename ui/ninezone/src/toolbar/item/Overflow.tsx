/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import { ExpandableItem, ExpandableItemProps } from "./expandable/Expandable";
import { Item } from "./Icon";
import "./Overflow.scss";

/** Properties of [[Overflow]] component. */
export interface OverflowProps extends ExpandableItemProps {
  /** Function called when button is clicked. */
  onClick?: () => void;
}

/** Expandable toolbar item component that displays ellipsis icon. Used in [[Toolbar]] */
export class Overflow extends React.PureComponent<OverflowProps> {
  public render() {
    const className = classnames(
      "nz-toolbar-item-overflow",
      this.props.className);

    const { onClick, ...props } = this.props;

    return (
      <ExpandableItem
        className={className}
        {...props}
      >
        <Item
          className="nz-ellipsis-icon"
          onClick={onClick}
          icon={
            <div className="nz-ellipsis" />
          }
        />
      </ExpandableItem>
    );
  }
}
