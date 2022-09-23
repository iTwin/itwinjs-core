/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./WidgetOutline.scss";
import classnames from "classnames";
import * as React from "react";
import { useTargeted } from "../base/DragManager";
import { WidgetIdContext } from "../widget/Widget";
import { withTargetVersion } from "../target/TargetOptions";
import { isTabDropTargetState, isWidgetDropTargetState } from "../state/DropTargetState";

/** @internal */
export const WidgetOutline = withTargetVersion("2", function WidgetOutline() {
  const hidden = useHidden();
  const className = classnames(
    "nz-outline-widgetOutline",
    hidden && "nz-hidden",
  );
  return (
    <div
      className={className}
    />
  );
});

// istanbul ignore next
function useHidden() {
  const widgetId = React.useContext(WidgetIdContext);
  const targeted = useTargeted();
  return React.useMemo(() => {
    if (!targeted)
      return true;

    if (isWidgetDropTargetState(targeted) && targeted.widgetId === widgetId)
      return false;

    if (isTabDropTargetState(targeted) && targeted.widgetId === widgetId)
      return false;

    return true;
  }, [targeted, widgetId]);
}
