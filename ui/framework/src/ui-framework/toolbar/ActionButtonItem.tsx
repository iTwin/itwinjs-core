/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import * as React from "react";
import { ActionButton, ConditionalBooleanValue, ConditionalStringValue, OnItemExecutedFunc } from "@bentley/ui-abstract";
import { BadgeUtilities } from "@bentley/ui-core";
import { Item } from "@bentley/ui-ninezone";
import { ToolbarHelper } from "./ToolbarHelper";
import { onEscapeSetFocusToHome } from "../hooks/useEscapeSetFocusToHome";

/** Action button props
 *  @internal
 */
interface ActionButtonProps {
  item: ActionButton;
  onItemExecuted?: OnItemExecutedFunc;
}

/** ActionItem toolbar Function component
 * @internal
 */
export function ActionButtonItem(props: ActionButtonProps) {
  const { item } = props;
  const execute = () => {
    item.execute();
    if (props.onItemExecuted)
      props.onItemExecuted(item);
  };
  return (<Item
    isActive={item.isActive}
    isDisabled={ConditionalBooleanValue.getValue(item.isDisabled)}
    title={ConditionalStringValue.getValue(item.label)}
    key={item.id}
    onClick={execute}
    onKeyDown={onEscapeSetFocusToHome}
    icon={ToolbarHelper.getIconReactNode(item)}
    badge={BadgeUtilities.getComponentForBadgeType(item.badgeType)}
  />);
}
