/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */

import { Id64String, IModelStatus } from "@bentley/bentleyjs-core";
import { IModelJson } from "@bentley/geometry-core";
import { ColorDefProps } from "./ColorDef";

/**
 * @internal
 */
export interface CreatePolyfaceRequestProps {
  elementId: Id64String;
  /** Max distance from a face to the original geometry, see [StrokeOptions]($geometry-core) */
  chordTol?: number;
  /** Max angle difference in approximated face, see [StrokeOptions]($geometry-core) */
  angleTol?: number;
  /** Max length of any edge in generated faces, see [StrokeOptions]($geometry-core) */
  maxEdgeLength?: number;
  /** BRep features with bounding boxes smaller than this size will not generate graphics.
   * This option can be used to ignore expensive details from [BRepEntity.DataProps]($imodeljs-common)
   * like screws and screw holes.
   */
  minBRepFeatureSize?: number;
}

/**
 * @internal
 */
export interface CreatePolyfaceResponseResult {
  indexedMesh: IModelJson.IndexedMeshProps;
  lineColor: ColorDefProps;
  fillColor: ColorDefProps;
  materialDiffuseColor?: ColorDefProps;
}

/**
 * @internal
 */
export interface CreatePolyfaceResponseProps {
  status: IModelStatus;
  results?: CreatePolyfaceResponseResult[];
}
