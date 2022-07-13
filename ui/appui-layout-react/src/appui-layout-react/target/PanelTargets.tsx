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
import { assert } from "@itwin/core-bentley";
import { isHorizontalPanelSide, PanelSideContext, PanelStateContext } from "../widget-panels/Panel";
import { TargetProps } from "./Target";
import { TargetContainer } from "./TargetContainer";
import { isHorizontalPanelState } from "../base/NineZoneState";
import { PanelTarget } from "./PanelTarget";
import { WidgetTarget } from "./WidgetTarget";
import { SectionTarget } from "./SectionTarget";

/** @internal */
export const PanelTargets = React.memo(function PanelTargets() { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const panel = React.useContext(PanelStateContext);
  assert(!!panel);
  const direction = usePanelTargetsDirection();
  const type = usePanelTargetsType();
  const className = classnames(
    "nz-target-panelTargets",
    `nz-${panel.side}`,
    type === "two-widgets" && "nz-wide",
    isHorizontalPanelState(panel) && panel.span && "nz-span",
  );

  const panelState = React.useContext(PanelStateContext);
  assert(!!panelState);

  let targets;
  if (type === "no-panel") {
    targets = <PanelTarget side={panel.side} />;
  } else if (type === "single-widget") {
    targets = <>
      <SectionTarget sectionIndex={0} />
      <WidgetTarget widgetId={panel.widgets[0]} />
      <SectionTarget sectionIndex={1} />
    </>;
  } else if (type === "two-widgets") {
    targets = <>
      <WidgetTarget widgetId={panel.widgets[0]} />
      <WidgetTarget widgetId={panel.widgets[1]} />
    </>;
  }
  return (
    <TargetContainer
      className={className}
      direction={direction}
    >
      {targets}
    </TargetContainer>
  );
});

function usePanelTargetsDirection(): TargetProps["direction"] {
  const panelSide = React.useContext(PanelSideContext);
  assert(!!panelSide);

  if (isHorizontalPanelSide(panelSide)) {
    return "horizontal";
  }

  return "vertical";
}

function usePanelTargetsType(): "no-panel" | "single-widget" | "two-widgets" | "hidden" {
  const panelState = React.useContext(PanelStateContext);
  assert(!!panelState);

  if (panelState.widgets.length === 0)
    return "no-panel";

  if (!panelState.collapsed)
    return "hidden";

  if (panelState.widgets.length === 2)
    return "two-widgets";

  assert(panelState.widgets.length === 1);
  return "single-widget";
}
