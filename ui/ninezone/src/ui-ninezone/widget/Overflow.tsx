/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import classnames from "classnames";
import * as React from "react";
import { useResizeObserver, useOnOutsideClick, useRefs } from "@bentley/ui-core";
import { WidgetMenu } from "./Menu";
import "./Overflow.scss";

/** @internal */
export interface WidgetOverflowProps {
  children?: React.ReactNode;
  hidden?: boolean;
  onResize?: (w: number) => void;
}

/** @internal */
export const WidgetOverflow = React.memo<WidgetOverflowProps>(function WidgetOverflow(props) { // tslint:disable-line: variable-name no-shadowed-variable
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const resizeObserverRef = useResizeObserver<HTMLDivElement>(props.onResize);
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
    props.hidden && "nz-hidden",
  );
  return (
    <div
      className={className}
      ref={refs}
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
});
