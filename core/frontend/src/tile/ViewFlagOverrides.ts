/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import {
  RenderMode,
  ViewFlagOverrides,
  ViewFlagPresence,
  ViewFlags,
} from "@bentley/imodeljs-common";

/** Create ViewFlagOverrides suitable for most non-iModel tile trees (reality/map tiles).
 * @param options Customize the overrides. Any properties left unspecified use the current view settings, except white-on-white reversal is always disabled.
 * @internal
 */
export function createDefaultViewFlagOverrides(options: { clipVolume?: boolean, shadows?: boolean, lighting?: boolean }): ViewFlagOverrides {
  const noLights = undefined !== options.lighting ? !options.lighting : undefined;
  const ovrs = new ViewFlagOverrides(ViewFlags.fromJSON({
    renderMode: RenderMode.SmoothShade,
    noCameraLights: noLights,
    noSourceLights: noLights,
    noSolarLight: noLights,
    clipVol: options.clipVolume,
    shadows: options.shadows,
    noWhiteOnWhiteReversal: true,
  }));

  if (undefined === options.clipVolume)
    ovrs.clearPresent(ViewFlagPresence.ClipVolume);

  if (undefined === options.shadows)
    ovrs.clearPresent(ViewFlagPresence.Shadows);

  if (undefined === options.lighting)
    ovrs.clearPresent(ViewFlagPresence.Lighting);

  return ovrs;
}
