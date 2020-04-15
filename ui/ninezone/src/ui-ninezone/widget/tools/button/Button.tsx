/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Button.scss";

/** Properties of [[ToolbarButton]] component.
 * @alpha
 */
export interface ToolbarButtonProps extends CommonProps {
  /** Button content. */
  children?: React.ReactNode;
  /** Function called when the button is clicked. */
  onClick?: () => void;
  /** Indicates whether to use a small App button */
  small?: boolean;
  /** Opacity for the background color */
  backgroundOpacity?: number;
}

/** Basic toolbar button. Used in [[Toolbar]] component.
 * @alpha
 */
export class ToolbarButton extends React.PureComponent<ToolbarButtonProps> {
  public render() {
    const className = classnames(
      "nz-toolbar-button-button",
      this.props.className);
    const buttonStyle: React.CSSProperties = {
      ...this.props.style,
    };
    const useBackgroundOpacity = this.props.backgroundOpacity !== undefined;

    if (useBackgroundOpacity)
      buttonStyle.backgroundColor = `rgba(var(--buic-background-3-rgb), ${this.props.backgroundOpacity})`;

    return (
      <button
        className={className}
        style={buttonStyle}
        onClick={this.props.onClick}
      >
        {!this.props.small &&
          <div className="nz-gradient" />
        }
        {this.props.children}
      </button>
    );
  }
}
