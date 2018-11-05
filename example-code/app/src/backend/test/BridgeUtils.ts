/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelDb, SpatialCategory, ModelSelector, CategorySelector, DisplayStyle3d, OrthographicViewDefinition, ViewDefinition, Subject, DefinitionPartition, DefinitionModel } from "@bentley/imodeljs-backend";
import { Id64String, Id64 } from "@bentley/bentleyjs-core";
import { CodeSpec, CodeScopeSpec, ColorDef, CategoryProps, SubCategoryAppearance, ModelSelectorProps, CategorySelectorProps, DefinitionElementProps, SpatialViewDefinitionProps, GeometryStreamProps, GeometryStreamBuilder, SubjectProps, InformationPartitionElementProps, IModel, Code, BisCodeSpec } from "@bentley/imodeljs-common";
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

// __PUBLISH_EXTRACT_START__ insertDefinitionModel.example-code
export function insertDefinitionModel(parentSubject: Subject, modelName: string): Id64String {
  const iModelDb = parentSubject.iModel;
  const partitionProps: InformationPartitionElementProps = {
    classFullName: DefinitionPartition.classFullName,
    model: IModel.repositoryModelId,
    parent: {
      id: parentSubject.id,
      relClassName: "BisCore:SubjectOwnsPartitionElements",
    },
    code: DefinitionPartition.createCode(iModelDb, parentSubject.id, modelName),
  };
  const partitionId: Id64String = iModelDb.elements.insertElement(partitionProps);
  const model: DefinitionModel = iModelDb.models.createModel({
    classFullName: DefinitionModel.classFullName,
    modeledElement: { id: partitionId },
  }) as DefinitionModel;
  return iModelDb.models.insertModel(model);
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

// __PUBLISH_EXTRACT_START__ InsertSpatialCategory.example-code
export function insertSpatialCategory(iModelDb: IModelDb, modelId: Id64String, name: string, color: ColorDef): Id64String {
  const categoryProps: CategoryProps = {
    classFullName: SpatialCategory.classFullName,
    model: modelId,
    code: SpatialCategory.createCode(iModelDb, modelId, name),
    isPrivate: false,
  };
  const categoryId: Id64String = iModelDb.elements.insertElement(categoryProps);
  const category: SpatialCategory = iModelDb.elements.getElement(categoryId) as SpatialCategory;
  category.setDefaultAppearance(new SubCategoryAppearance({ color }));
  iModelDb.elements.updateElement(category);
  return categoryId;
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ InsertModelSelector.example-code
export function insertModelSelector(iModelDb: IModelDb, modelId: Id64String, models: string[]): Id64String {
  const modelSelectorProps: ModelSelectorProps = {
    classFullName: ModelSelector.classFullName,
    model: modelId,
    code: { spec: BisCodeSpec.modelSelector, scope: modelId },
    models,
  };
  return iModelDb.elements.insertElement(modelSelectorProps);
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ InsertCategorySelector.example-code
export function insertCategorySelector(iModelDb: IModelDb, modelId: Id64String, categories: string[]): Id64String {
  const categorySelectorProps: CategorySelectorProps = {
    classFullName: CategorySelector.classFullName,
    model: modelId,
    code: { spec: BisCodeSpec.categorySelector, scope: modelId },
    categories,
  };
  return iModelDb.elements.insertElement(categorySelectorProps);
}
// __PUBLISH_EXTRACT_END__

// __PUBLISH_EXTRACT_START__ InsertDisplayStyle3d.example-code
export function insertDisplayStyle3d(iModelDb: IModelDb, modelId: Id64String): Id64String {
  const displayStyleProps: DefinitionElementProps = {
    classFullName: DisplayStyle3d.classFullName,
    model: modelId,
    code: { spec: BisCodeSpec.displayStyle, scope: modelId },
    isPrivate: false,
  };
  return iModelDb.elements.insertElement(displayStyleProps);
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
    camera: { eye: [0, 0, 0], lens: 0, focusDist: 0 }, // not used when cameraOn === false
  };
  return iModelDb.elements.insertElement(viewDefinitionProps);
}
// __PUBLISH_EXTRACT_END__
