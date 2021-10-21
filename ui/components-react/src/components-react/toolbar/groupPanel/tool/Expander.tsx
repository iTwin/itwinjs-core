/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import "./Expander.scss";
import classnames from "classnames";
import * as React from "react";
import { NoChildrenProps, Omit } from "@itwin/core-react";
import { GroupTool, GroupToolProps } from "./Tool";

/** Properties of [[GroupToolExpander]] component.
 * @internal
 */
export interface GroupToolExpanderProps extends Omit<GroupToolProps, "isActive" | "children">, NoChildrenProps {
}

/** Expandable entry of tool group panel. Used in [[GroupColumn]] to select nested Groups.
 * @internal
 */
// eslint-disable-next-line react/display-name
export const GroupToolExpander = React.memo<React.FC<GroupToolExpanderProps>>(
  (props: GroupToolExpanderProps) => {
    const { className, ...otherProps } = props;

    const expanderClassName = classnames(
      "components-toolbar-item-expandable-group-tool-expander",
      className);

    return (
      <GroupTool
        className={expanderClassName}
        {...otherProps}>
        <div className="components-expansion-indicator" />
      </GroupTool>
    );
  });
