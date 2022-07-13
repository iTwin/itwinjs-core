/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./TabOutline.scss";
import classnames from "classnames";
import * as React from "react";
import { useTargeted } from "../base/DragManager";
import { isWidgetTargetState } from "../base/NineZoneState";
import { WidgetIdContext } from "../widget/Widget";

/** @internal */
export function TabOutline() { // eslint-disable-line @typescript-eslint/naming-convention
  const hidden = useHidden();
  const className = classnames(
    "nz-outline-tabOutline",
    hidden && "nz-hidden",
  );
  return (
    <div
      className={className}
    />
  );
}

function useHidden() {
  const widgetId = React.useContext(WidgetIdContext);
  const targeted = useTargeted();
  return React.useMemo(() => {
    if (!targeted)
      return true;

    if (!isWidgetTargetState(targeted))
      return true;

    if (targeted.widgetId !== widgetId)
      return true;

    return false;
  }, [targeted,  widgetId]);
}
