/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import { Omit } from "@bentley/ui-core";
import { NoChildrenProps } from "../../../../../utilities/Props";
import { GroupTool, GroupToolProps } from "./Tool";
import "./Expander.scss";

/** Properties of [[Expander]] component. */

export interface GroupToolExpanderProps extends Omit<GroupToolProps, "isActive" | "children">, NoChildrenProps {
}

/** Expandable entry of tool group panel. Used in [[Column]] hosted in [[NestedGroup]] component. */
export class GroupToolExpander extends React.PureComponent<GroupToolExpanderProps> {
  public render() {
    const { className, ...props } = this.props;

    const expanderClassName = classnames(
      "nz-toolbar-item-expandable-group-tool-expander",
      className);

    return (
      <GroupTool
        className={expanderClassName}
        {...props}>
        <div className="nz-expansion-indicator">
          >
        </div>
      </GroupTool>
    );
  }
}
