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
import { isTabTargetState, isWidgetTargetState } from "../base/NineZoneState";
import { WidgetIdContext } from "../widget/Widget";
import { withTargetVersion } from "../target/TargetOptions";

/** @internal */
export const WidgetOutline = withTargetVersion("2", function WidgetOutline(){ // eslint-disable-line @typescript-eslint/naming-convention
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

function useHidden() {
  const widgetId = React.useContext(WidgetIdContext);
  const targeted = useTargeted();
  return React.useMemo(() => {
    if (!targeted)
      return true;

    if (isWidgetTargetState(targeted) && targeted.widgetId === widgetId)
      return false;

    if (isTabTargetState(targeted) && targeted.widgetId === widgetId)
      return false;

    return true;
  }, [targeted,  widgetId]);
}
