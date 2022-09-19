/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WidgetPanels
 */

import "./PanelOutline.scss";
import classnames from "classnames";
import * as React from "react";
import { assert } from "@itwin/core-bentley";
import { useTargeted } from "../base/DragManager";
import { isHorizontalPanelSide, PanelSideContext, PanelStateContext } from "../widget-panels/Panel";
import { withTargetVersion } from "../target/TargetOptions";
import { isHorizontalPanelState } from "../state/PanelState";
import { isPanelDropTargetState } from "../state/DropTargetState";

/** @internal */
export const PanelOutline = withTargetVersion("2", function PanelOutline() {
  const panel = React.useContext(PanelStateContext);
  assert(!!panel);
  const { side } = panel;
  const hidden = useHidden();
  const className = classnames(
    "nz-outline-panelOutline",
    hidden && "nz-hidden",
    `nz-${side}`,
    isHorizontalPanelState(panel) && panel.span && "nz-span",
  );
  const size = useSize();
  const isHorizontal = isHorizontalPanelSide(side);
  return (
    <div
      className={className}
      style={{
        width: isHorizontal ? undefined : size,
        height: isHorizontal ? size : undefined,
      }}
    />
  );
});

/** @internal */
export function useHidden() {
  const side = React.useContext(PanelSideContext);
  const targeted = useTargeted();
  if (!targeted)
    return true;

  if (!isPanelDropTargetState(targeted))
    return true;

  if (targeted.side !== side)
    return true;

  return false;
}

function useSize() {
  const panel = React.useContext(PanelStateContext);
  assert(!!panel);
  // istanbul ignore next
  return panel.size !== undefined ? panel.size : panel.minSize;
}
