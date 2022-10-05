/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */
import * as React from "react";
import { PanelSideContext } from "../widget-panels/Panel";
import { assert } from "@itwin/core-bentley";
import { useAllowedSideTarget } from "./useAllowedSideTarget";

/** Check the docking side against allowed regions
 * @internal
 */
export function useAllowedPanelTarget() {
  const side = React.useContext(PanelSideContext);
  assert (!!side);

  return useAllowedSideTarget(side, false);
}
