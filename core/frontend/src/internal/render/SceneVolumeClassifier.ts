/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@itwin/core-bentley";
import { ActiveSpatialClassifier } from "../../SpatialClassifiersState";
import type { IModelDisplayReference } from "../../IModelDisplayReference";

/** Describes the spatial classification applied to a [[Scene]]. */
export interface SceneVolumeClassifier {
  classifier: ActiveSpatialClassifier;
  modelId: Id64String;
  /** The reference from which the classified model originates. Model Ids are only unique within a single iModel, so the
   * reference is required to identify the classified geometry when linked iModels are displayed.
   */
  iModelRef: IModelDisplayReference;
}

