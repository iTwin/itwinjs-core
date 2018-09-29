/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import { Omit, NoChildrenProps } from "../../../../../utilities/Props";
import Tool, { ToolProps } from "./Tool";
import "./Expander.scss";

/** Properties of [[Expander]] component. */
export interface ExpanderProps extends Omit<ToolProps, "isActive" | "children">, NoChildrenProps {
}

/** Expandable entry of tool group panel. Used in [[Column]] hosted in [[NestedGroup]] component. */
export default class Expander extends React.Component<ExpanderProps> {
  public render() {
    const { className, ...props } = this.props;

    const expanderClassName = classnames(
      "nz-toolbar-item-expandable-group-tool-expander",
      className);

    return (
      <Tool
        className={expanderClassName}
        {...props}>
        <div className="nz-expansion-indicator">
          >
        </div>
      </Tool>
    );
  }
}
