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
import { useResizeObserver } from "../base/useResizeObserver";
import { useOnOutsideClick } from "../base/useOnOutsideClick";
import { useRefs } from "../base/useRefs";
import { WidgetMenu } from "./Menu";
import { useWidgetTab } from "./Tabs";
import "./Overflow.scss";

/** @internal */
export interface WidgetOverflowProps extends CommonProps {
  children?: React.ReactNode;
}

/** @internal */
export function WidgetOverflow(props: WidgetOverflowProps) {
  const [open, setOpen] = React.useState(false);
  const { onResize } = useWidgetTab();
  const ref = React.useRef<HTMLDivElement>(null);
  const resizeObserverRef = useResizeObserver<HTMLDivElement>(onResize);
  const refs = useRefs(ref, resizeObserverRef);
  const handleClick = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setOpen((prev) => !prev);
  }, []);
  const onOutsideClick = React.useCallback(() => {
    setOpen(false);
  }, []);
  const isOutsideEvent = React.useCallback((e: PointerEvent) => {
    return !!ref.current && (e.target instanceof Node) && !ref.current.contains(e.target);
  }, []);
  const menuRef = useOnOutsideClick<HTMLDivElement>(onOutsideClick, isOutsideEvent);
  const className = classnames(
    "nz-widget-overflow",
    props.className,
  );
  return (
    <div
      className={className}
      ref={refs}
      style={props.style}
    >
      <div
        className="nz-button"
        onClick={handleClick}
      >
        <div className="nz-icon" />
      </div>
      {open && <WidgetMenu
        children={props.children}
        ref={menuRef}
      />}
    </div>
  );
}
