/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { CompressedId64Set, Id64String, IModelStatus } from "@itwin/core-bentley";
import { Matrix3dProps, Range3dProps, TransformProps } from "@itwin/core-geometry";
import { EcefLocationProps, ElementGeometryBuilderParams, ElementGeometryInfo, ElementGeometryOpcode, GeometricElementProps, GeometryPartProps } from "@itwin/core-common";
import { EditCommandIpc } from "./EditorIpc";

/** Command ids for built in EditCommandIpc classes.
 * @beta
 */
export const editorBuiltInCmdIds = {
  cmdBasicManipulation: "basicManipulation",
};

/** Optional criteria for requesting a GeometryStream from the backend.
 * @beta
 */
export interface FlatBufferGeometryFilter {
  /** Optional limit on number of displayable entries to accept */
  maxDisplayable?: number;
  /** Optional array of displayable opCodes to accept */
  accept?: ElementGeometryOpcode[];
  /** Optional array of displayable opCodes to reject */
  reject?: ElementGeometryOpcode[];
  /** Optional geometry type filter
   * curves - true to accept single curves and paths
   * surfaces - true to accept loops, planar regions, open polyfaces, and sheet bodies
   * solids - true to accept capped solids, closed polyfaces, and solid bodies
   */
  geometry?: { curves: boolean, surfaces: boolean, solids: boolean };
}

/** Interface for a backend EditCommand command that provides basic creation and modification operations.
 * @beta
 */
export interface BasicManipulationCommandIpc extends EditCommandIpc {
  deleteElements(ids: CompressedId64Set): Promise<IModelStatus>;
  transformPlacement(ids: CompressedId64Set, transform: TransformProps): Promise<IModelStatus>;
  rotatePlacement(ids: CompressedId64Set, matrix: Matrix3dProps, aboutCenter: boolean): Promise<IModelStatus>;

  /** Create and insert a new geometric element.
   * @param props Properties for the new [GeometricElement]($backend)
   * @see [GeometryStream]($docs/learning/common/geometrystream.md), [ElementGeometry]($common)
   * @throws [[IModelError]] if unable to insert the element
   */
  insertGeometricElement(props: GeometricElementProps): Promise<Id64String>;

  /** Create and insert a new geometry part element.
   * @param props Properties for the new [GeometryPart]($backend)
   * @see [GeometryStream]($docs/learning/common/geometrystream.md), [ElementGeometry]($common)
   * @throws [[IModelError]] if unable to insert the element
   */
  insertGeometryPart(props: GeometryPartProps): Promise<Id64String>;

  /** Update an existing geometric element.
   * @param propsOrId Properties or element id to update for an existing [GeometricElement]($backend)
   * @param data Optional binary format GeometryStream representation used in lieu of [[GeometricElementProps.geom]] or [[GeometricElementProps.elementGeometryBuilderParams]].
   * @see [GeometryStream]($docs/learning/common/geometrystream.md), [ElementGeometry]($common)
   * @throws [[IModelError]] if unable to update the element
   */
  updateGeometricElement(propsOrId: GeometricElementProps | Id64String, data?: ElementGeometryBuilderParams): Promise<void>;

  /** Request geometry from an existing element. Because a GeometryStream can be large and may contain information
   * that is not always useful to frontend code, filter options are provided to restrict what GeometryStreams are returned.
   * For example, a tool may only be interested in a GeometryStream that stores a single CurveCollection.
   * @param id Element id of an existing [GeometricElement]($backend) or [GeometryPart]($backend).
   * @param filter Optional criteria for accepting a GeometryStream.
   * @see [GeometryStream]($docs/learning/common/geometrystream.md), [ElementGeometry]($common)
   * @throws [[IModelError]] if unable to query the element
   */
  requestElementGeometry(id: Id64String, filter?: FlatBufferGeometryFilter): Promise<ElementGeometryInfo | undefined>;

  /** Update the project extents for the iModel.
   * @param extents New project extents.
   * @throws [[IModelError]] if unable to aquire schema lock or update the extents property.
   */
  updateProjectExtents(extents: Range3dProps): Promise<void>;

  /** Update the position of the iModel on the earth.
   * @param ecefLocation New ecef location properties.
   * @throws [[IModelError]] if unable to aquire schema lock or update the ecef location property.
   * @note Clears the geographic coordinate reference system of the iModel, do not call when a valid GCS exists.
   */
  updateEcefLocation(ecefLocation: EcefLocationProps): Promise<void>;
}
