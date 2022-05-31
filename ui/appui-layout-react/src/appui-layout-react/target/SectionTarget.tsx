/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./SectionTarget.scss";
import classnames from "classnames";
import * as React from "react";
import { assert } from "@itwin/core-bentley";
import { DraggedWidgetIdContext, useTarget } from "../base/DragManager";
import { CursorTypeContext, DraggedTabContext, getUniqueId } from "../base/NineZone";
import { getCursorClassName } from "../widget-panels/CursorOverlay";
import { Target } from "./Target";
import { PanelSideContext } from "../widget-panels/Panel";
import { useTargetDirection } from "./WidgetTarget";
import { SectionTargetState } from "../base/NineZoneState";

/** @internal */
export interface SectionTargetProps {
  sectionIndex: 0 | 1;
}

/** @internal */
export const SectionTarget = React.memo<SectionTargetProps>(function SectionTarget(props) { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const { sectionIndex } = props;
  const cursorType = React.useContext(CursorTypeContext);
  const draggedTab = React.useContext(DraggedTabContext);
  const draggedWidgetId = React.useContext(DraggedWidgetIdContext);
  const direction = useTargetDirection();
  const [ref, targeted] = useTarget<HTMLDivElement>(useSectionTargetArgs(sectionIndex));
  const hidden = !draggedTab && !draggedWidgetId;
  const className = classnames(
    "nz-target-widgetTarget",
    hidden && "nz-hidden",
    cursorType && getCursorClassName(cursorType),
  );
  return (
    <Target
      className={className}
      direction={direction}
      section={sectionIndex === 0 ? "start" : "end"}
      targeted={targeted}
      ref={ref}
    />
  );
});

function useSectionTargetArgs(sectionIndex: number) {
  const side = React.useContext(PanelSideContext);
  return React.useMemo<SectionTargetState>(() => {
    assert(!!side);
    return {
      type: "section",
      side,
      sectionIndex,
      newWidgetId: getUniqueId(),
    };
  }, [side, sectionIndex]);
}
