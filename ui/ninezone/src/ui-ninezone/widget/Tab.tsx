/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { useResizeObserver } from "../base/useResizeObserver";
import { useSingleDoubleClick } from "../base/useSingleDoubleClick";
import { useRefs } from "../base/useRefs";
import { usePane } from "../widget-panels/Panes";
import { useWidgetTab } from "./Tabs";
import "./Tab.scss";

/** Properties of [[WidgetTab]] component.
 * @internal future
 */
export interface WidgetTabProps extends CommonProps {
  active?: boolean;
  children?: React.ReactNode;
  onClick?: () => void;
}

/** Component that displays a tab in a side panel widget.
 * @internal future
 */
export function WidgetTab(props: WidgetTabProps) {
  const { active, onClick } = props;
  const { isOverflown, onResize } = useWidgetTab();
  const pane = usePane();
  const resizeObserverRef = useResizeObserver<HTMLDivElement>(onResize);
  const handleClick = React.useCallback(() => {
    onClick && onClick();
    if (pane.minimized) {
      pane.onRestore();
      return;
    }
    active && pane.onExpand();
  }, [active, onClick, pane]);
  const handleDoubleClick = React.useCallback(() => {
    if (pane.minimized) {
      onClick && onClick();
      pane.onExpand();
      return;
    }
    if (!active) {
      onClick && onClick();
      return;
    }
    pane.onMinimize();
  }, [active, onClick, pane]);
  const doubleClickRef = useSingleDoubleClick<HTMLDivElement>(handleClick, handleDoubleClick);
  const refs = useRefs<HTMLDivElement>(resizeObserverRef, doubleClickRef);
  const className = classnames(
    "nz-widget-tab",
    active && "nz-active",
    isOverflown && "nz-overflown",
    pane.minimized && "nz-minimized",
    props.className,
  );
  return (
    <div
      className={className}
      ref={refs}
      style={props.style}
    >
      <span>{props.children}</span>
      {isOverflown && <div className="nz-icon" />}
    </div>
  );
}
