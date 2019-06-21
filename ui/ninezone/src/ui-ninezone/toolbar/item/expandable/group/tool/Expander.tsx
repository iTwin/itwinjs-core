/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import { Omit, NoChildrenProps } from "@bentley/ui-core";
import { GroupTool, GroupToolProps } from "./Tool";
import "./Expander.scss";

/** Properties of [[GroupToolExpander]] component.
 * @alpha
 */

export interface GroupToolExpanderProps extends Omit<GroupToolProps, "isActive" | "children">, NoChildrenProps {
}

/** Expandable entry of tool group panel. Used in [[GroupColumn]] hosted in [[NestedGroup]] component.
 * @alpha
 */
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
        <div className="nz-expansion-indicator" />
      </GroupTool>
    );
  }
}
