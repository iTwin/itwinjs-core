/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Toolbar
 */

import "./Tool.scss";
import classnames from "classnames";
import * as React from "react";
import { ActionButton, GroupButton } from "@itwin/appui-abstract";
import { CommonProps, useTargeted } from "@itwin/core-react";

/** Properties of [[GroupTool]] component.
 * @internal
 */
export interface GroupToolProps extends CommonProps {
  /** Additional content, besides icon and label. */
  children?: React.ReactNode;
  /** Tool icon. */
  icon?: React.ReactNode;
  /** Describes if the item is active. */
  isActive?: boolean;
  /** Describes if the item is disabled. */
  isDisabled?: boolean;
  /** Describes if the item is focused. */
  isFocused?: boolean;
  /** Tool label. */
  label?: string;
  /** Function called when the item is clicked. */
  onClick?: (item: GroupButton | ActionButton) => void;
  /** Function called when pointer up event is received. */
  onPointerUp?: (item: GroupButton | ActionButton) => void;
  /** A badge to draw. */
  badge?: React.ReactNode;
  /** GroupButton item */
  item: GroupButton | ActionButton;
  /** Optional function to call on any KeyDown events processed by toolbar */
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

/** Tool entry of tool group panel. Used in [[GroupColumn]].
 * @internal
 */
export function GroupTool(props: GroupToolProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const targeted = useTargeted(ref);
  const itemClassName = classnames(
    "components-toolbar-item-expandable-group-tool-item",
    props.isActive && "components-active",
    props.isFocused && "components-focused",
    props.isDisabled && "components-disabled",
    props.onPointerUp && "components-pointer-up",
    targeted && "components-targeted",
    props.className);

  const handleClick = React.useCallback(() => {
    // istanbul ignore else
    if (!props.isDisabled && props.onClick)
      props.onClick(props.item);
  }, [props]);

  const handlePointerUp = React.useCallback(() => {
    // istanbul ignore else
    if (!props.isDisabled && props.onPointerUp)
      props.onPointerUp(props.item);
  }, [props]);

  return (
    <div
      className={itemClassName}
      onClick={handleClick}
      onKeyDown={props.onKeyDown}
      onPointerUp={handlePointerUp}
      ref={ref}
      style={props.style}
      role="button"
      tabIndex={0}
    >
      <div className="components-icon">
        {props.icon}
        {props.badge &&
          <div className="components-badge">
            {props.badge}
          </div>
        }
      </div>
      <div className="components-label">
        {props.label}
      </div>
      {props.children}
    </div>
  );
}
