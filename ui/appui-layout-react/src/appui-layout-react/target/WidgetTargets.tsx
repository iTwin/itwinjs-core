/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./WidgetTargets.scss";
import * as React from "react";
import { isHorizontalPanelSide, PanelSideContext, PanelStateContext } from "../widget-panels/Panel";
import { Target, TargetProps } from "./Target";
import { TargetContainer } from "./TargetContainer";

/** @internal */
export const WidgetTargets = React.memo(function WidgetTargets() { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const targets = useWidgetTargets();
  const direction = useWidgetTargetsDirection();
  return (
    <TargetContainer
      className="nz-target-widgetTargets"
      direction={direction}
    >
      {targets.map((section) => <Target
        key={section}
        direction={direction}
        type={section}
      />)}
    </TargetContainer>
  );
});

const fill = ["fill"] as const;
const dock = ["start", "fill", "end"] as const;

function useWidgetTargetsDirection(): TargetProps["direction"] {
  const panelSide = React.useContext(PanelSideContext);
  if (!panelSide)
    return "horizontal";

  if (isHorizontalPanelSide(panelSide)) {
    return "horizontal";
  }

  return "vertical";
}

function useWidgetTargets(): typeof fill | typeof dock {
  const panelState = React.useContext(PanelStateContext);
  if (!panelState)
    return fill;

  if (panelState.widgets.length === 1)
    return dock;

  return fill;
}
