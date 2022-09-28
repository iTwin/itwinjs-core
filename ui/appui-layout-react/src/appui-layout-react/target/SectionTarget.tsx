/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WidgetPanels
 */

import "./SectionTarget.scss";
import classnames from "classnames";
import * as React from "react";
import { assert } from "@itwin/core-bentley";
import { DraggedWidgetIdContext, useTarget } from "../base/DragManager";
import { CursorTypeContext, DraggedTabContext, getUniqueId } from "../base/NineZone";
import { getCursorClassName } from "../widget-panels/CursorOverlay";
import { isHorizontalPanelSide, PanelSideContext } from "../widget-panels/Panel";
import { useAllowedPanelTarget } from "./PanelTarget";
import { SectionDropTargetState } from "../state/DropTargetState";

/** @internal */
export interface SectionTargetProps {
  sectionIndex: 0 | 1;
}

/** @internal */
export function SectionTarget(props: SectionTargetProps) {
  const { sectionIndex } = props;
  const cursorType = React.useContext(CursorTypeContext);
  const draggedTab = React.useContext(DraggedTabContext);
  const draggedWidgetId = React.useContext(DraggedWidgetIdContext);
  const direction = useTargetDirection();
  const [ref, targeted] = useTarget<HTMLDivElement>(useSectionTargetArgs(sectionIndex));
  const allowedTarget = useAllowedPanelTarget();
  const hidden = (!draggedTab && !draggedWidgetId) || !allowedTarget;
  const className = classnames(
    "nz-target-sectionTarget",
    `nz-${direction}`,
    // istanbul ignore next
    targeted && "nz-targeted",
    hidden && "nz-hidden",
    // istanbul ignore next
    cursorType && getCursorClassName(cursorType),
  );
  return (
    <div
      className={className}
      ref={ref}
    >
      <div className={classnames(
        "nz-section",
        "nz-start",
        sectionIndex === 0 && "nz-target",
      )} />
      <div className="nz-border" />
      <div className={classnames(
        "nz-section",
        "nz-end",
        sectionIndex === 1 && "nz-target",
      )} />
    </div>
  );
}

/** @internal */
export function useSectionTargetArgs(sectionIndex: number) {
  const side = React.useContext(PanelSideContext);
  const newWidgetId = React.useMemo(() => getUniqueId(), []);
  return React.useMemo<SectionDropTargetState>(() => {
    assert(!!side);
    return {
      type: "section",
      side,
      sectionIndex,
      newWidgetId,
    };
  }, [side, sectionIndex, newWidgetId]);
}

/** @internal */
export function useTargetDirection(): "horizontal" | "vertical" {
  const side = React.useContext(PanelSideContext);
  assert(!!side);

  if (isHorizontalPanelSide(side)) {
    return "horizontal";
  }

  return "vertical";
}
