/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@bentley/bentleyjs-core";
import { SpatialClassificationProps } from "@bentley/imodeljs-common";
import { RenderGraphic } from "./RenderGraphic";
import { RenderPlanarClassifier } from "./RenderPlanarClassifier";
import { RenderTextureDrape } from "./RenderSystem";

/** Describes the spatial classification applied to a [[Scene]].
 * @internal
 */
export interface SceneVolumeClassifier {
  classifier: SpatialClassificationProps.Classifier;
  modelId: Id64String;
}

/** Holds a collection of objects comprising a [[Viewport]]'s scene.
 * @internal
 */
export class Scene {
  public readonly foreground: RenderGraphic[] = [];
  public readonly background: RenderGraphic[] = [];
  public readonly overlay: RenderGraphic[] = [];
  public readonly planarClassifiers = new Map<Id64String, RenderPlanarClassifier>(); // Classifier model id to planar classifier.
  public readonly textureDrapes = new Map<Id64String, RenderTextureDrape>();
  public volumeClassifier?: SceneVolumeClassifier;
}
