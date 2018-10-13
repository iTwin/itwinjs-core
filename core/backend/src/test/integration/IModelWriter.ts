/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Id64 } from "@bentley/bentleyjs-core";
import { Box, Point3d, Vector3d, XYZProps } from "@bentley/geometry-core";
import {
  SubCategoryAppearance, CategorySelectorProps, CategoryProps, CodeScopeSpec, CodeSpec, ColorDef, DefinitionElementProps,
  GeometryStreamBuilder, GeometryStreamProps, IModel, InformationPartitionElementProps, ModelSelectorProps, SpatialViewDefinitionProps, BisCodeSpec,
} from "@bentley/imodeljs-common";
import {
  CategorySelector, DisplayStyle3d, IModelDb, ModelSelector, OrthographicViewDefinition, PhysicalModel, PhysicalPartition,
  SpatialCategory, ViewDefinition,
} from "../../backend";

export class IModelWriter {

  /** Insert a CodeSpec */
  public static insertCodeSpec(iModelDb: IModelDb, name: string, scopeType: CodeScopeSpec.Type): Id64 {
    const codeSpec = new CodeSpec(iModelDb, new Id64(), name, scopeType);
    iModelDb.codeSpecs.insert(codeSpec);
    return codeSpec.id;
  }

  /** Insert a PhysicalModel */
  public static insertPhysicalModel(iModelDb: IModelDb, modelName: string): Id64 {
    const partitionProps: InformationPartitionElementProps = {
      classFullName: PhysicalPartition.classFullName,
      model: IModel.repositoryModelId,
      parent: {
        id: IModel.rootSubjectId,
        relClassName: "BisCore:SubjectOwnsPartitionElements",
      },
      code: PhysicalPartition.createCode(iModelDb, IModel.rootSubjectId, modelName),
    };
    const partitionId: Id64 = iModelDb.elements.insertElement(partitionProps);
    const model: PhysicalModel = iModelDb.models.createModel({
      classFullName: PhysicalModel.classFullName,
      modeledElement: { id: partitionId },
    }) as PhysicalModel;
    return iModelDb.models.insertModel(model);
  }

  /** Insert a SpatialCategory */
  public static insertSpatialCategory(iModelDb: IModelDb, modelId: Id64, name: string, color: ColorDef): Id64 {
    const categoryProps: CategoryProps = {
      classFullName: SpatialCategory.classFullName,
      model: modelId,
      code: SpatialCategory.createCode(iModelDb, modelId, name),
      isPrivate: false,
    };
    const categoryId: Id64 = iModelDb.elements.insertElement(categoryProps);
    const category: SpatialCategory = iModelDb.elements.getElement(categoryId) as SpatialCategory;
    category.setDefaultAppearance(new SubCategoryAppearance({ color }));
    iModelDb.elements.updateElement(category);
    return categoryId;
  }

  /** Insert a ModelSelector which is used to select which Models are displayed by a ViewDefinition. */
  public static insertModelSelector(iModelDb: IModelDb, modelId: Id64, models: string[]): Id64 {
    const modelSelectorProps: ModelSelectorProps = {
      classFullName: ModelSelector.classFullName,
      model: modelId,
      code: { spec: BisCodeSpec.modelSelector, scope: modelId },
      models,
    };
    return iModelDb.elements.insertElement(modelSelectorProps);
  }

  /** Insert a CategorySelector which is used to select which categories are displayed by a ViewDefinition. */
  public static insertCategorySelector(iModelDb: IModelDb, modelId: Id64, categories: string[]): Id64 {
    const categorySelectorProps: CategorySelectorProps = {
      classFullName: CategorySelector.classFullName,
      code: { spec: BisCodeSpec.categorySelector, scope: modelId },
      model: modelId,
      categories,
    };
    return iModelDb.elements.insertElement(categorySelectorProps);
  }

  /** Insert a DisplayStyle3d for use by a ViewDefinition. */
  public static insertDisplayStyle3d(iModelDb: IModelDb, modelId: Id64): Id64 {
    const displayStyleProps: DefinitionElementProps = {
      classFullName: DisplayStyle3d.classFullName,
      model: modelId,
      code: { spec: BisCodeSpec.displayStyle, scope: modelId },
      isPrivate: false,
    };
    return iModelDb.elements.insertElement(displayStyleProps);
  }

  /** Insert an OrthographicViewDefinition */
  public static insertOrthographicViewDefinition(
    iModelDb: IModelDb,
    modelId: Id64,
    viewName: string,
    modelSelectorId: Id64,
    categorySelectorId: Id64,
    displayStyleId: Id64,
    origin: XYZProps,
    extents: XYZProps,
  ): Id64 {
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
