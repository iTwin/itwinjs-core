/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
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
