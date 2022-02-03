/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import type { ViewFlagOverrides} from "@itwin/core-common";
import { RenderMode, ViewFlags } from "@itwin/core-common";

/** Create ViewFlagOverrides suitable for most non-iModel tile trees (reality/map tiles).
 * @param options Customize the overrides. Any properties left unspecified use the current view settings, except white-on-white reversal is always disabled.
 * @internal
 */
export function createDefaultViewFlagOverrides(options: { clipVolume?: boolean, shadows?: boolean, lighting?: boolean, thematic?: false }): ViewFlagOverrides {
  const noLights = undefined !== options.lighting ? !options.lighting : undefined;
  const viewflags = ViewFlags.fromJSON({
    renderMode: RenderMode.SmoothShade,
    noCameraLights: noLights,
    noSourceLights: noLights,
    noSolarLight: noLights,
    clipVol: options.clipVolume,
    shadows: options.shadows,
    noWhiteOnWhiteReversal: true,
    thematicDisplay: false,
  });

  const ovrs: ViewFlagOverrides = { ...viewflags };
  if (undefined === options.clipVolume)
    ovrs.clipVolume = undefined;

  if (undefined === options.shadows)
    ovrs.shadows = undefined;

  if (undefined === options.lighting)
    ovrs.lighting = undefined;

  if (undefined === options.thematic)
    ovrs.thematicDisplay = undefined;

  return ovrs;
}
