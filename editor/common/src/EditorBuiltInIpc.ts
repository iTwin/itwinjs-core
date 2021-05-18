/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { CompressedId64Set, Id64String, IModelStatus } from "@bentley/bentleyjs-core";
import { Matrix3dProps, TransformProps } from "@bentley/geometry-core";
import { ElementGeometryDataEntry, GeometricElementProps, GeometryPartProps } from "@bentley/imodeljs-common";
import { EditCommandIpc } from "./EditorIpc";

/** @alpha */
export const editorBuiltInCmdIds = {
  cmdBasicManipulation: "basicManipulation",
};

/** @alpha */
export interface InsertGeometricElementData {
  /** The geometry stream data */
  entryArray: ElementGeometryDataEntry[];
  /** Whether entries are supplied local to placement transform or in world coordinates */
  isWorld?: boolean;
  /** If true, create geometry that displays oriented to face the camera */
  viewIndependent?: boolean;
}

/** @alpha */
export interface InsertGeometryPartData {
  /** The geometry stream data */
  entryArray: ElementGeometryDataEntry[];
  /** If true, create geometry part with 2d geometry */
  is2dPart?: boolean;
}

/** @alpha */
export interface BasicManipulationCommandIpc extends EditCommandIpc {
  deleteElements: (ids: CompressedId64Set) => Promise<IModelStatus>;
  transformPlacement: (ids: CompressedId64Set, transform: TransformProps) => Promise<IModelStatus>;
  rotatePlacement: (ids: CompressedId64Set, matrix: Matrix3dProps, aboutCenter: boolean) => Promise<IModelStatus>;

  /** Create and insert a new geometric element.
   * @param props Properties for the new [GeometricElement]($backend)
   * @param data Optional binary format GeometryStream representation used in lieu of [[GeometricElementProps.geom]].
   * @see [GeometryStream]($docs/learning/common/geometrystream.md), [ElementGeometry]($backend)
   * @throws [[IModelError]] if unable to insert the element
   */
  insertGeometricElement(props: GeometricElementProps, data?: InsertGeometricElementData): Promise<Id64String>;

  /** Create and insert a new geometry part element.
   * @param props Properties for the new [GeometryPart]($backend)
   * @param data Optional binary format GeometryStream representation used in lieu of  [[GeometryPartProps.geom]].
   * @see [GeometryStream]($docs/learning/common/geometrystream.md), [ElementGeometry]($backend)
   * @throws [[IModelError]] if unable to insert the element
   */
  insertGeometryPart(props: GeometryPartProps, data?: InsertGeometryPartData): Promise<Id64String>;
}
