/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import * as React from "react";
import { ActionButton, ConditionalBooleanValue, OnItemExecutedFunc, ConditionalStringValue } from "@bentley/ui-abstract";
import { BadgeUtilities } from "@bentley/ui-core";
import { Item } from "@bentley/ui-ninezone";
import { KeyboardShortcutManager } from "../../ui-framework";
import { ToolbarHelper } from "./ToolbarHelper";

function handleKeyDown(e: React.KeyboardEvent): void {
  // istanbul ignore else
  if (e.key === "Escape") {
    KeyboardShortcutManager.setFocusToHome();
  }
}

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
    onKeyDown={handleKeyDown}
    icon={ToolbarHelper.getIconReactNode(item)}
    badge={BadgeUtilities.getComponentForBadge(item.badgeType)}
  />);
}
