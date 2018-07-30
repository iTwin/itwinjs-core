/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../../../../utilities/Props";

import Tool from "./Tool";

import "./Expander.scss";

export interface ExpanderProps extends CommonProps {
  isFocused?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  label?: string;
}

export default class Expander extends React.Component<ExpanderProps> {
  public render() {
    const { className, style, ...props } = this.props;

    const expanderClassName = classnames(
      "nz-toolbar-item-expandable-group-tool-expander",
      this.props.className);

    return (
      <div
        className={expanderClassName}
        style={style}
      >
        <Tool {...props}>
          <div className="nz-expansion-indicator">
            >
          </div>
        </Tool>
      </div>
    );
  }
}
