/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import { OmitChildrenProp, NoChildrenProps } from "../../utilities/Props";
import Icon, { ToolbarIconProps } from "./Icon";
import "./Back.scss";

/** Properties of [[BackButton]] component. */
export interface BackButtonProps extends OmitChildrenProp<ToolbarIconProps>, NoChildrenProps {
}

/**
 * Back button which displays icon. Used in [[Toolbar]] component.
 * @note See basic button: [[ToolbarButton]]
 */
export default class BackButton extends React.Component<BackButtonProps> {
  public render() {
    const { className, ...props } = this.props;
    const buttonClassName = classnames(
      "nz-toolbar-button-back",
      className);

    return (
      <Icon
        className={buttonClassName}
        {...props}
      />
    );
  }
}
