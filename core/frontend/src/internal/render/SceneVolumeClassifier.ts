/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@itwin/core-bentley";
import { ActiveSpatialClassifier } from "../../SpatialClassifiersState";

/** Describes the spatial classification applied to a [[Scene]]. */
export interface SceneVolumeClassifier {
  classifier: ActiveSpatialClassifier;
  modelId: Id64String;
}

