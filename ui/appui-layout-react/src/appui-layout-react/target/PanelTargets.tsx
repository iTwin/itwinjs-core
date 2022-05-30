/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./PanelTargets.scss";
import classnames from "classnames";
import * as React from "react";
import { isHorizontalPanelSide, PanelSideContext, PanelStateContext } from "../widget-panels/Panel";
import { Target, TargetProps } from "./Target";
import { TargetContainer } from "./TargetContainer";
import { assert } from "@itwin/core-bentley";

/** @internal */
export const PanelTargets = React.memo(function PanelTargets() { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const panelSide = React.useContext(PanelSideContext);
  const targets = usePanelTargets();
  const direction = usePanelTargetsDirection();
  const className = classnames(
    "nz-target-panelTargets",
    `nz-${panelSide}`,
    targets.length === 2 && "nz-wide",
  );
  return (
    <TargetContainer
      className={className}
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

const noPanel = ["panel"] as const;
const singleWidget = ["start", "fill", "end"] as const;
const twoWidgets = ["fill", "fill"] as const;

function usePanelTargetsDirection(): TargetProps["direction"] {
  const panelSide = React.useContext(PanelSideContext);
  assert(!!panelSide);

  if (isHorizontalPanelSide(panelSide)) {
    return "horizontal";
  }

  return "vertical";
}

function usePanelTargets(): typeof noPanel | typeof singleWidget | typeof twoWidgets {
  const panelState = React.useContext(PanelStateContext);
  assert(!!panelState);

  if (panelState.widgets.length === 0)
    return noPanel;

  if (panelState.widgets.length === 2)
    return twoWidgets;

  return singleWidget;
}
