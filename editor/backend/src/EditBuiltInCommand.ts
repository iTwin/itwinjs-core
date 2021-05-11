/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { CompressedId64Set, DbResult, Id64String, IModelStatus } from "@bentley/bentleyjs-core";
import { Matrix3d, Matrix3dProps, Point3d, PointString3d, Transform, TransformProps } from "@bentley/geometry-core";
import { GeometricElement, IModelDb } from "@bentley/imodeljs-backend";
import { ElementGeometryUpdate, GeometricElementProps, GeometryPartProps, GeometryStreamBuilder, IModelError } from "@bentley/imodeljs-common";
import { BasicManipulationCommandIpc, editorBuiltInCmdIds, InsertGeometricElementData, InsertGeometryPartData } from "@bentley/imodeljs-editor-common";
import { EditCommand } from "./EditCommand";

/** @alpha */
export class BasicManipulationCommand extends EditCommand implements BasicManipulationCommandIpc {
  public static commandId = editorBuiltInCmdIds.cmdBasicManipulation;

  public constructor(iModel: IModelDb, protected _str: string) { super(iModel); }

  public async deleteElements(ids: CompressedId64Set): Promise<IModelStatus> {
    for (const id of CompressedId64Set.iterable(ids))
      this.iModel.elements.deleteElement(id);

    return IModelStatus.Success;
  }

  public async transformPlacement(ids: CompressedId64Set, transProps: TransformProps): Promise<IModelStatus> {
    const transform = Transform.fromJSON(transProps);

    for (const id of CompressedId64Set.iterable(ids)) {
      const element = this.iModel.elements.getElement<GeometricElement>(id);

      if (!element.placement.isValid)
        continue; // Ignore assembly parents w/o geometry, etc...

      element.placement.multiplyTransform(transform);
      this.iModel.elements.updateElement(element);
    }

    return IModelStatus.Success;
  }

  public async rotatePlacement(ids: CompressedId64Set, matrixProps: Matrix3dProps, aboutCenter: boolean): Promise<IModelStatus> {
    const matrix = Matrix3d.fromJSON(matrixProps);

    for (const id of CompressedId64Set.iterable(ids)) {
      const element = this.iModel.elements.getElement<GeometricElement>(id);

      if (!element.placement.isValid)
        continue; // Ignore assembly parents w/o geometry, etc...

      const fixedPoint = aboutCenter ? element.placement.calculateRange().center : Point3d.createFrom(element.placement.origin);
      const transform = Transform.createFixedPointAndMatrix(fixedPoint, matrix);

      element.placement.multiplyTransform(transform);
      this.iModel.elements.updateElement(element);
    }

    return IModelStatus.Success;
  }

  public async insertGeometricElement(props: GeometricElementProps, data?: InsertGeometricElementData): Promise<Id64String> {
    const newElem = this.iModel.elements.createElement(props);
    const newId = this.iModel.elements.insertElement(newElem);
    if (undefined === data)
      return newId;

    const updateProps: ElementGeometryUpdate = {
      elementId: newId,
      entryArray: data.entryArray,
      isWorld: data.isWorld,
      viewIndependent: data.viewIndependent,
    };

    const status = this.iModel.elementGeometryUpdate(updateProps);
    if (DbResult.BE_SQLITE_OK !== status) {
      this.iModel.elements.deleteElement(newId); // clean up element...
      throw new IModelError(status, "Error updating element geometry");
    }

    return newId;
  }

  public async insertGeometryPart(props: GeometryPartProps, data?: InsertGeometryPartData): Promise<Id64String> {
    if (undefined === props.geom && undefined !== data) {
      const builder = new GeometryStreamBuilder();
      builder.appendGeometry(PointString3d.create(Point3d.createZero()));
      props.geom = builder.geometryStream; // can't insert a DgnGeometryPart without geometry...
    }

    const newElem = this.iModel.elements.createElement(props);
    const newId = this.iModel.elements.insertElement(newElem);
    if (undefined === data)
      return newId;

    const updateProps: ElementGeometryUpdate = {
      elementId: newId,
      entryArray: data.entryArray,
      is2dPart: data.is2dPart,
    };

    const status = this.iModel.elementGeometryUpdate(updateProps);
    if (DbResult.BE_SQLITE_OK !== status) {
      this.iModel.elements.deleteElement(newId); // clean up element...
      throw new IModelError(status, "Error updating part geometry");
    }

    return newId;
  }
}
