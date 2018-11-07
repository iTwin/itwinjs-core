/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Id64Array, Id64String, Id64 } from "@bentley/bentleyjs-core";
import { BisCodeSpec, CategoryProps, CategorySelectorProps, ColorDef, CreateIModelProps, DefinitionElementProps, InformationPartitionElementProps, ModelSelectorProps, SubCategoryAppearance, SpatialViewDefinitionProps, ViewFlags, AnalysisStyleProps } from "@bentley/imodeljs-common";
import { SpatialCategory } from "./Category";
import { DefinitionPartition, PhysicalPartition } from "./Element";
import { IModelDb } from "./IModelDb";
import { DefinitionModel, PhysicalModel } from "./Model";
import { CategorySelector, DisplayStyle3d, ModelSelector, ViewDefinition, OrthographicViewDefinition } from "./ViewDefinition";
import { Matrix3d, Transform, StandardViewIndex, YawPitchRollAngles, Range3d } from "@bentley/geometry-core";

/** Abstract base class that contains helper methods for writing an iModel importer. */
export abstract class IModelImporter {
  /** The iModel created by this importer. */
  public iModelDb: IModelDb;
  /**
   * Construct a new IModelImporter
   * @param iModelFileName the output iModel file name
   * @param iModelProps props to use when creating the iModel
   */
  protected constructor(iModelFileName: string, iModelProps: CreateIModelProps) {
    this.iModelDb = IModelDb.createStandalone(iModelFileName, iModelProps);
  }
  /** Subclass of Importer should implement this method to perform the actual import. */
  public abstract import(): void;
  /**
   * Insert a new SpatialCategory
   * @param definitionModelId Insert the new SpatialCategory into this DefinitionModel
   * @param name The name of the SpatialCategory
   * @param color The color to use for the default SubCategory of this SpatialCategory
   * @returns The Id of the newly inserted SpatialCategory element.
   */
  public insertSpatialCategory(definitionModelId: Id64String, name: string, color: ColorDef): Id64String {
    const categoryProps: CategoryProps = {
      classFullName: SpatialCategory.classFullName,
      model: definitionModelId,
      code: SpatialCategory.createCode(this.iModelDb, definitionModelId, name),
      isPrivate: false,
    };
    const categoryId: Id64String = this.iModelDb.elements.insertElement(categoryProps);
    const category: SpatialCategory = this.iModelDb.elements.getElement(categoryId) as SpatialCategory;
    category.setDefaultAppearance(new SubCategoryAppearance({ color }));
    this.iModelDb.elements.updateElement(category);
    return categoryId;
  }
  /**
   * Insert a ModelSelector which is used to select which Models are displayed by a ViewDefinition.
   * @param definitionModelId Insert the new ModelSelector into this DefinitionModel
   * @param name The name of the ModelSelector
   * @param models Array of models to select for display
   * @returns The Id of the newly inserted ModelSelector element.
   */
  public insertModelSelector(definitionModelId: Id64String, name: string, models: Id64Array): Id64String {
    const modelSelectorProps: ModelSelectorProps = {
      classFullName: ModelSelector.classFullName,
      code: { spec: this.iModelDb.codeSpecs.getByName(BisCodeSpec.modelSelector).id, scope: definitionModelId, value: name },
      model: definitionModelId,
      models,
    };
    return this.iModelDb.elements.insertElement(modelSelectorProps);
  }
  /**
   * Insert a CategorySelector which is used to select which categories are displayed by a ViewDefinition.
   * @param definitionModelId Insert the new CategorySelector into this DefinitionModel
   * @param name The name of the CategorySelector
   * @param categories Array of categories to select for display
   * @returns The Id of the newly inserted CategorySelector element.
   */
  public insertCategorySelector(definitionModelId: Id64String, name: string, categories: Id64Array): Id64String {
    const categorySelectorProps: CategorySelectorProps = {
      classFullName: CategorySelector.classFullName,
      code: { spec: this.iModelDb.codeSpecs.getByName(BisCodeSpec.categorySelector).id, scope: definitionModelId, value: name },
      model: definitionModelId,
      categories,
    };
    return this.iModelDb.elements.insertElement(categorySelectorProps);
  }
  /**
   * Insert a DisplayStyle3d for use by a ViewDefinition.
   * @param definitionModelId Insert the new CategorySelector into this DefinitionModel
   * @param name The name of the CategorySelector
   * @returns The Id of the newly inserted DisplayStyle3d element.
   */
  public insertDisplayStyle3d(definitionModelId: Id64String, name: string, viewFlagsIn?: ViewFlags, backgroundColor?: ColorDef, analysisStyle?: AnalysisStyleProps): Id64String {
    const stylesIn: { [k: string]: any } = { viewflags: viewFlagsIn ? viewFlagsIn : new ViewFlags() };

    if (analysisStyle)
      stylesIn.analysisStyle = analysisStyle;

    if (backgroundColor)
      stylesIn.backgroundColor = backgroundColor;

    const displayStyleProps: DefinitionElementProps = {
      classFullName: DisplayStyle3d.classFullName,
      code: { spec: this.iModelDb.codeSpecs.getByName(BisCodeSpec.displayStyle).id, scope: definitionModelId, value: name },
      model: definitionModelId,
      jsonProperties: { styles: stylesIn },
      isPrivate: false,
    };
    return this.iModelDb.elements.insertElement(displayStyleProps);
  }
  /**
   * Insert a DefinitionModel
   * @param parentSubjectId The DefinitionPartition will be inserted as a child of this Subject element.
   * @param name The name of the DefinitionPartition that the new DefinitionModel will break down.
   * @returns The Id of the newly inserted DefinitionModel.
   */
  public insertDefinitionModel(parentSubjectId: Id64String, name: string): Id64String {
    const partitionProps: InformationPartitionElementProps = {
      classFullName: DefinitionPartition.classFullName,
      model: IModelDb.repositoryModelId,
      parent: {
        id: parentSubjectId,
        relClassName: "BisCore:SubjectOwnsPartitionElements",
      },
      code: DefinitionPartition.createCode(this.iModelDb, parentSubjectId, name),
    };
    const partitionId: Id64String = this.iModelDb.elements.insertElement(partitionProps);
    const model: DefinitionModel = this.iModelDb.models.createModel({
      classFullName: DefinitionModel.classFullName,
      modeledElement: { id: partitionId },
    }) as DefinitionModel;
    return this.iModelDb.models.insertModel(model);
  }
  /**
   * Insert a PhysicalModel
   * @param parentSubjectId The PhysicalPartition will be inserted as a child of this Subject element.
   * @param name The name of the PhysicalPartition that the new PhysicalModel will break down.
   * @returns The Id of the newly inserted PhysicalModel.
   */
  public insertPhysicalModel(parentSubjectId: Id64String, name: string): Id64String {
    const partitionProps: InformationPartitionElementProps = {
      classFullName: PhysicalPartition.classFullName,
      model: IModelDb.repositoryModelId,
      parent: {
        id: parentSubjectId,
        relClassName: "BisCore:SubjectOwnsPartitionElements",
      },
      code: PhysicalPartition.createCode(this.iModelDb, parentSubjectId, name),
    };
    const partitionId: Id64String = this.iModelDb.elements.insertElement(partitionProps);
    const model: PhysicalModel = this.iModelDb.models.createModel({
      classFullName: PhysicalModel.classFullName,
      modeledElement: { id: partitionId },
    }) as PhysicalModel;
    return this.iModelDb.models.insertModel(model);
  }
  public createOrthographicView(viewName: string, definitionModelId: Id64String, modelSelectorId: Id64String, categorySelectorId: Id64String, displayStyleId: Id64String, range: Range3d, standardView = StandardViewIndex.Iso): Id64String {
    const rotation = Matrix3d.createStandardWorldToView(standardView);
    const angles = YawPitchRollAngles.createFromMatrix3d(rotation);
    const rotationTransform = Transform.createOriginAndMatrix(undefined, rotation);
    const rotatedRange = rotationTransform.multiplyRange(range);
    const viewOrigin = rotation.multiplyTransposeXYZ(rotatedRange.low.x, rotatedRange.low.y, rotatedRange.low.z);
    const viewExtents = rotatedRange.diagonal();

    const viewDefinitionProps: SpatialViewDefinitionProps = {
      classFullName: OrthographicViewDefinition.classFullName,
      model: IModelDb.dictionaryId,
      code: ViewDefinition.createCode(this.iModelDb, definitionModelId, viewName),
      modelSelectorId,
      categorySelectorId,
      displayStyleId,
      origin: viewOrigin,
      extents: viewExtents,
      angles,
      cameraOn: false,
      camera: { eye: [0, 0, 0], lens: 0, focusDist: 0 }, // not used when cameraOn === false
    };
    return this.iModelDb.elements.insertElement(viewDefinitionProps);
  }
  public setDefaultViewId(viewId: Id64String) {
    const spec = { namespace: "dgn_View", name: "DefaultView" };
    const blob32 = new Uint32Array(2);

    blob32[0] = Id64.getLowerUint32(viewId);
    blob32[1] = Id64.getUpperUint32(viewId);
    const blob8 = new Uint8Array(blob32.buffer);
    this.iModelDb.saveFileProperty(spec, undefined, blob8);
  }
}
