/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import ExpandableComponent, { ExpandableProps as ExpandableComponentProps } from "../../base/Expandable";
import "./Expandable.scss";

/** Properties of [[ExpandableButton]] component. */
export interface ExpandableButtonProps extends ExpandableComponentProps {
  /** One of toolbar buttons. I.e.: [[ToolbarIcon]] */
  button?: React.ReactNode;
}

/** Expandable toolbar button. Used in [[Toolbar]] component. */
export default class ExpandableButton extends React.Component<ExpandableButtonProps> {
  public render() {
    const { className, ...props } = this.props;
    const buttonClassName = classnames(
      "nz-toolbar-button-expandable",
      className);

    return (
      <ExpandableComponent
        className={buttonClassName}
        {...props}
      >
        <div className="nz-button">
          {this.props.button}
          <div className="nz-triangle" />
        </div>
        {this.props.children}
      </ExpandableComponent>
    );
  }
}
