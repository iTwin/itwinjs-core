/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WidgetPanels
 */

import "./SectionTargets.scss";
import * as React from "react";
import { assert } from "@itwin/core-bentley";
import { PanelStateContext } from "../widget-panels/Panel";
import { TargetContainer } from "./TargetContainer";
import { WidgetTarget } from "./WidgetTarget";
import { WidgetIdContext } from "../widget/Widget";
import { SectionTarget, useTargetDirection } from "./SectionTarget";
import { withTargetVersion } from "./TargetOptions";

/** @internal */
export const SectionTargets = withTargetVersion("2", function SectionTargets() {
  const type = useWidgetTargetsType();
  const direction = useTargetDirection();
  const widgetId = React.useContext(WidgetIdContext);
  let targets;
  if (type === "merge") {
    targets = <WidgetTarget widgetId={widgetId} />;
  } else {
    targets = <>
      <SectionTarget sectionIndex={0}  />
      <WidgetTarget widgetId={widgetId} />
      <SectionTarget sectionIndex={1} />
    </>;
  }
  return (
    <TargetContainer
      className="nz-target-sectionTargets"
      direction={direction}
    >
      {targets}
    </TargetContainer>
  );
});

function useWidgetTargetsType(): "merge" | "sections" {
  const panelState = React.useContext(PanelStateContext);
  assert(!!panelState);

  if (panelState.widgets.length === 1)
    return "sections";

  return "merge";
}
