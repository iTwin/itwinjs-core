/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { Id64String } from "@itwin/core-bentley";
import { GeometryClass } from "@itwin/core-common";

/** Options used when constructing a `Batch` - that is, a [[RenderGraphic]] with an associated [FeatureTable]($common) describing individual [Feature]($common)s within the
 * graphic. Individual features can be resymbolized in a variety of ways including flashing and hiliting.
 * For example, to prevent graphics produced by [[readElementGraphics]] from being hilited when their corresponding element is in the [[SelectionSet]],
 * pass `{ noHilite: true }` to [[readElementGraphics]].
 * @public
 * @extensions
 */
export interface BatchOptions {
  /** Identifies the [[Tile]] associated with the batch, chiefly for debugging purposes.
   * @beta
   */
  tileId?: string;
  /** If true, features within the batch will not be flashed on mouseover. */
  noFlash?: boolean;
  /** If true, features within the batch will not be hilited when their corresponding element is in the [[SelectionSet]]. */
  noHilite?: boolean;
  /** If true, features within the batch will not be emphasized when the corresponding [[Feature]] is emphasized using [FeatureOverrides]($common). */
  noEmphasis?: boolean;
  /** If true, the contents of the batch will only be drawn by [[Viewport.readPixels]], not [[Viewport.renderFrame]], causing them to be locatable but invisible. */
  locateOnly?: boolean;
}

/** Options used as part of [[GraphicBuilderOptions]] to describe a [pickable]($docs/learning/frontend/ViewDecorations#pickable-view-graphic-decorations) [[RenderGraphic]].
 * @public
 * @extensions
 */
export interface PickableGraphicOptions extends BatchOptions {
  /** A unique identifier for the graphic.
   * @see [[IModelConnection.transientIds]] to obtain a unique Id in the context of an iModel.
   * @see [[GraphicBuilder.activatePickableId]] or [[GraphicBuilder.activateFeature]] to change the pickable object while adding geometry.
   */
  id: Id64String;
  /** Optional Id of the subcategory with which the graphic should be associated. */
  subCategoryId?: Id64String;
  /** Optional geometry class for the graphic - defaults to [GeometryClass.Primary]($common). */
  geometryClass?: GeometryClass;
  /** The optional Id of the model with which the graphic should be associated. */
  modelId?: Id64String;
  /** True if the graphic is to be used as a [[DynamicSpatialClassifier]] to classify volumes of a reality model. */
  isVolumeClassifier?: boolean;
}

