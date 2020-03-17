/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import { DraggedTabContext, CursorTypeContext } from "../base/NineZone";
import { getCursorClassName } from "../widget-panels/CursorOverlay";
import { WidgetIdContext } from "./Widget";
import { assert } from "../base/assert";
import { DraggedWidgetContext, useTabTarget } from "../base/DragManager";
import "./TabTarget.scss";

/** @internal */
export interface WidgetTabTargetProps {
  tabIndex: number;
  first?: boolean;
}

/** Component that displays a tab target.
 * @internal
 */
export const WidgetTabTarget = React.memo<WidgetTabTargetProps>(function WidgetTabTarget(props) { // tslint:disable-line: variable-name no-shadowed-variable
  const { first, tabIndex } = props;
  const cursorType = React.useContext(CursorTypeContext);
  const widgetId = React.useContext(WidgetIdContext);
  const draggedTab = React.useContext(DraggedTabContext);
  const draggedWidget = React.useContext(DraggedWidgetContext);
  assert(widgetId);
  const onTargeted = useTabTarget({
    tabIndex: first ? tabIndex : tabIndex + 1,
    widgetId,
  });
  const [targeted, setTargeted] = React.useState(false);
  const handleTargeted = React.useCallback((t) => {
    setTargeted(t);
    onTargeted(t);
  }, [onTargeted]);
  const ref = useTarget<HTMLDivElement>(handleTargeted);
  const hidden = !draggedTab && !draggedWidget;
  const className = classnames(
    "nz-widget-tabTarget",
    hidden && "nz-hidden",
    targeted && "nz-targeted",
    cursorType && getCursorClassName(cursorType),
  );
  return (
    <div
      className={className}
      ref={ref}
    />
  );
});

/** @internal */
export function useTarget<T extends Element>(onTargeted: (targeted: boolean) => void) {
  const targeted = React.useRef(false);
  const ref = React.useRef<T>(null);
  React.useEffect(() => {
    const handleDocumentPointerMove = (e: PointerEvent) => {
      const newTargeted = !!ref.current && !!e.target && (e.target instanceof Node) && ref.current.contains(e.target);
      newTargeted !== targeted.current && onTargeted(newTargeted);
      targeted.current = newTargeted;
    };
    document.addEventListener("pointermove", handleDocumentPointerMove);
    return () => {
      document.removeEventListener("pointermove", handleDocumentPointerMove);
    };
  });
  return ref;
}
