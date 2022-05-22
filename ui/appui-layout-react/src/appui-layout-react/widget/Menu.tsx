/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./Menu.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps, Popup } from "@itwin/core-react";
import { RelativePosition } from "@itwin/appui-abstract";

/** @internal */
export interface WidgetMenuProps extends CommonProps {
  children?: React.ReactNode;
  open?: boolean;
  onClose?: () => void;
  target?: HTMLElement;
}

/** @internal */
export function WidgetMenu(props: WidgetMenuProps) {
  const className = classnames(
    "nz-widget-menu",
    props.className,
  );
  return (
    <Popup
      className={className}
      isOpen={props.open}
      offset={0}
      onClose={props.onClose}
      position={RelativePosition.BottomLeft}
      style={props.style}
      showShadow={false}
      target={props.target}
    >
      {props.children}
    </Popup>
  );
}
