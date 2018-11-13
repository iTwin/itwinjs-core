/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelDb, OrthographicViewDefinition, ViewDefinition, Subject } from "@bentley/imodeljs-backend";
import { Id64String, Id64 } from "@bentley/bentleyjs-core";
import { CodeSpec, CodeScopeSpec, SpatialViewDefinitionProps, GeometryStreamProps, GeometryStreamBuilder, SubjectProps, Code, BisCodeSpec, Camera } from "@bentley/imodeljs-common";
import { XYZProps, Arc3d, Point3d } from "@bentley/geometry-core";

// __PUBLISH_EXTRACT_START__ insertSubject.example-code
export function insertSubject(parentElement: Subject, name: string): Subject {
  const codeSpec: CodeSpec = parentElement.iModel.codeSpecs.getByName(BisCodeSpec.subject);
  const code = new Code({ spec: codeSpec.id, scope: parentElement.id, value: name });
  const subjectProps: SubjectProps = {
    classFullName: Subject.classFullName,
    model: parentElement.model,
    code,
  };
  const id = parentElement.iModel.elements.insertElement(subjectProps);
  return parentElement.iModel.elements.getElement(id) as Subject;
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ InsertCodeSpec.example-code
export function insertCodeSpec(iModelDb: IModelDb, name: string, scopeType: CodeScopeSpec.Type): Id64String {
  const codeSpec = new CodeSpec(iModelDb, Id64.invalid, name, scopeType);
  iModelDb.codeSpecs.insert(codeSpec);
  return codeSpec.id;
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ GeometryStreamBuilder.example-code
// Simple example of using GeometryStreamBuilder. Note how the building works with
// geometry primitive types such as Arc3d.
export function generateGeometry(radius: number = 0.1): GeometryStreamProps {
  const builder = new GeometryStreamBuilder();
  const circle = Arc3d.createXY(Point3d.createZero(), radius);
  builder.appendGeometry(circle);
  return builder.geometryStream;
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ InsertOrthographicViewDefinition.example-code
export function insertOrthographicViewDefinition(
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
// __PUBLISH_EXTRACT_END__
