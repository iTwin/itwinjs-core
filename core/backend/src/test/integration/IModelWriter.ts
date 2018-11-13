/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Id64String, Id64 } from "@bentley/bentleyjs-core";
import { Box, Point3d, Vector3d, XYZProps } from "@bentley/geometry-core";
import { CodeScopeSpec, CodeSpec, GeometryStreamBuilder, GeometryStreamProps, SpatialViewDefinitionProps, Camera } from "@bentley/imodeljs-common";
import { IModelDb, OrthographicViewDefinition, ViewDefinition } from "../../backend";

export class IModelWriter {

  /** Insert a CodeSpec */
  public static insertCodeSpec(iModelDb: IModelDb, name: string, scopeType: CodeScopeSpec.Type): Id64String {
    const codeSpec = new CodeSpec(iModelDb, Id64.invalid, name, scopeType);
    iModelDb.codeSpecs.insert(codeSpec);
    return codeSpec.id;
  }

  /** Insert an OrthographicViewDefinition */
  public static insertOrthographicViewDefinition(
    iModelDb: IModelDb,
    modelId: Id64String,
    viewName: string,
    modelSelectorId: Id64String,
    categorySelectorId: Id64String,
    displayStyleId: Id64String,
    origin: XYZProps,
    extents: XYZProps,
  ): Id64String {
    const viewDefinitionProps: SpatialViewDefinitionProps = {
      classFullName: OrthographicViewDefinition.classFullName,
      model: modelId,
      code: ViewDefinition.createCode(iModelDb, modelId, viewName),
      modelSelectorId,
      categorySelectorId,
      displayStyleId,
      origin,
      extents,
      cameraOn: false,
      camera: new Camera(), // not used when cameraOn === false
    };
    return iModelDb.elements.insertElement(viewDefinitionProps);
  }

  /** Create a geometry stream containing a box */
  public static createBox(size: Point3d): GeometryStreamProps {
    const geometryStreamBuilder = new GeometryStreamBuilder();
    geometryStreamBuilder.appendGeometry(Box.createDgnBox(
      Point3d.createZero(), Vector3d.unitX(), Vector3d.unitY(), new Point3d(0, 0, size.z),
      size.x, size.y, size.x, size.y, true,
    )!);
    return geometryStreamBuilder.geometryStream;
  }
}
