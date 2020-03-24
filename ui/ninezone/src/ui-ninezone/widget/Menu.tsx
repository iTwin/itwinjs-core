/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import classnames from "classnames";
import * as React from "react";
import { CommonProps, useRefs } from "@bentley/ui-core";
import "./Menu.scss";

/** @internal */
export interface WidgetMenuProps extends CommonProps {
  children?: React.ReactNode;
  onClick?: () => void;
}

/** @internal */
// tslint:disable-next-line: variable-name
export const WidgetMenu = React.forwardRef<HTMLDivElement, WidgetMenuProps>((props, ref) => {
  const divRef = React.useRef<HTMLDivElement>(null);
  const refs = useRefs<HTMLDivElement>(ref, divRef);
  const [direction, setDirection] = React.useState<"left" | "right">("right");
  const [verticalDirection, setVerticalDirection] = React.useState<"top" | "bottom">("bottom");
  React.useLayoutEffect(() => {
    const rect = divRef.current!.getBoundingClientRect();
    const newDirection = rect.left < document.body.clientWidth / 2 ? "right" : "left";
    const newVerticalDirection = rect.top < document.body.clientHeight / 2 ? "bottom" : "top";
    setDirection(newDirection);
    setVerticalDirection(newVerticalDirection);
  }, []);
  const className = classnames(
    "nz-widget-menu",
    `nz-${direction}`,
    `nz-${verticalDirection}`,
    props.className,
  );
  return (
    <div
      className={className}
      onClick={props.onClick}
      ref={refs}
      style={props.style}
    >
      {props.children}
    </div>
  );
});
