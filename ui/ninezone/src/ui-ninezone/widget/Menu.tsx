/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { useRefs } from "../base/useRefs";
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
  React.useLayoutEffect(() => {
    const rect = divRef.current!.getBoundingClientRect();
    const newDirection = rect.left < document.body.clientWidth / 2 ? "right" : "left";
    setDirection(newDirection);
  }, []);
  const className = classnames(
    "nz-widget-menu",
    `nz-${direction}`,
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
