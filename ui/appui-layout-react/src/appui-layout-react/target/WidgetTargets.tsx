/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import "./WidgetTargets.scss";
import * as React from "react";
import { PanelStateContext } from "../widget-panels/Panel";
import { TargetContainer } from "./TargetContainer";
import { useTargetDirection, WidgetTarget } from "./WidgetTarget";
import { WidgetIdContext } from "../widget/Widget";
import { SectionTarget } from "./SectionTarget";

/** @internal */
export const WidgetTargets = React.memo(function WidgetTargets() { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
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
      className="nz-target-widgetTargets"
      direction={direction}
    >
      {targets}
    </TargetContainer>
  );
});

function useWidgetTargetsType(): "merge" | "sections" {
  const panelState = React.useContext(PanelStateContext);
  if (!panelState)
    return "merge";

  if (panelState.widgets.length === 1)
    return "sections";

  return "merge";
}
