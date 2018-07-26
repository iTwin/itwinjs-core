/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";

import ExpandableComponent, { ExpandableProps as ExpandableComponentProps } from "../../base/Expandable";
import "./Expandable.scss";

export interface ExpandableButtonProps extends ExpandableComponentProps {
  button?: React.ReactNode;
}

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
