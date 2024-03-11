/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { AmbientOcclusion, ColorDef, SolarShadowSettings, ViewFlags } from "@itwin/core-common";

export interface ScenePresentation2d {
  // ###TODO grid
  is2d: true;
  is3d?: never;
  viewFlags: ViewFlags;
  backgroundColor: ColorDef;
}

export interface ScenePresentation3d {
  // ###TODO grid
  is3d: true;
  is2d?: never;
  viewFlags: ViewFlags;
  backgroundColor:  ColorDef;
  // ###TODO Environment contains iModel-specific things like texture Ids.
  // environment: Environment;
  // toggleSkyBox(display?: boolean): void;
  // toggleAtmosphere(display?: boolean): void;
  ambientOcclusion: AmbientOcclusion.Settings;
  solarShadows: SolarShadowSettings;
}

export type ScenePresentation = ScenePresentation2d | ScenePresentation3d;
