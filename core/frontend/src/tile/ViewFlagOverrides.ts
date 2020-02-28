/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import {
  RenderMode,
  ViewFlag,
  ViewFlags,
} from "@bentley/imodeljs-common";

/** Create ViewFlag.Overrides suitable for most non-iModel tile trees (reality/map tiles).
 * @param options Customize the overrides. Any properties left unspecified use the current view settings.
 * @internal
 */
export function createDefaultViewFlagOverrides(options: { clipVolume?: boolean, shadows?: boolean, lighting?: boolean }): ViewFlag.Overrides {
  const noLights = undefined !== options.lighting ? !options.lighting : undefined;
  const ovrs = new ViewFlag.Overrides(ViewFlags.fromJSON({
    renderMode: RenderMode.SmoothShade,
    noCameraLights: noLights,
    noSourceLights: noLights,
    noSolarLight: noLights,
    clipVol: options.clipVolume,
    shadows: options.shadows,
  }));

  if (undefined === options.clipVolume)
    ovrs.clearPresent(ViewFlag.PresenceFlag.ClipVolume);

  if (undefined === options.shadows)
    ovrs.clearPresent(ViewFlag.PresenceFlag.Shadows);

  if (undefined === options.lighting)
    ovrs.clearPresent(ViewFlag.PresenceFlag.Lighting);

  return ovrs;
}
