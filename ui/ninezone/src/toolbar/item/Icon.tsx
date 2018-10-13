/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import { NoChildrenProps, OmitChildrenProp } from "../../utilities/Props";
import Item, { ItemProps } from "./Item";
import "./Icon.scss";

/** Properties of [[Icon]] component. */
export interface IconProps extends OmitChildrenProp<ItemProps>, NoChildrenProps {
  /** Actual icon of this toolbar item. */
  icon?: React.ReactNode;
}

/** Toolbar item component that displays icon. Used in [[Toolbar]] */
export default class Icon extends React.Component<IconProps> {
  public render() {
    const className = classnames(
      "nz-toolbar-item-icon",
      this.props.className);

    return (
      <Item
        {...this.props}
        className={className}
      >
        <div className="nz-icon">
          {this.props.icon}
        </div>
      </Item>
    );
  }
}
