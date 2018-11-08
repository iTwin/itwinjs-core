/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Id64Array, Id64String } from "@bentley/bentleyjs-core";
import {
  BisCodeSpec, CategoryProps, CategorySelectorProps, CreateIModelProps, DefinitionElementProps, InformationPartitionElementProps,
  ModelSelectorProps, SubCategoryAppearance, ModelProps,
} from "@bentley/imodeljs-common";
import { SpatialCategory } from "./Category";
import { DefinitionPartition, PhysicalPartition } from "./Element";
import { IModelDb } from "./IModelDb";
import { DefinitionModel, PhysicalModel } from "./Model";
import { CategorySelector, DisplayStyle3d, ModelSelector } from "./ViewDefinition";

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
  public insertSpatialCategory(definitionModelId: Id64String, name: string, defaultAppearance: SubCategoryAppearance.Props): Id64String {
    const categoryProps: CategoryProps = {
      classFullName: SpatialCategory.classFullName,
      model: definitionModelId,
      code: SpatialCategory.createCode(this.iModelDb, definitionModelId, name),
      isPrivate: false,
    };
    const elements = this.iModelDb.elements;
    const categoryId = elements.insertElement(categoryProps);
    const category = elements.getElement(categoryId) as SpatialCategory;
    category.setDefaultAppearance(defaultAppearance);
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
  public insertDisplayStyle3d(definitionModelId: Id64String, name: string): Id64String {
    const displayStyleProps: DefinitionElementProps = {
      classFullName: DisplayStyle3d.classFullName,
      code: { spec: this.iModelDb.codeSpecs.getByName(BisCodeSpec.displayStyle).id, scope: definitionModelId, value: name },
      model: definitionModelId,
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
    const partitionId = this.iModelDb.elements.insertElement(partitionProps);
    const model: ModelProps = {
      classFullName: DefinitionModel.classFullName,
      modeledElement: { id: partitionId },
    };
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
    const partitionId = this.iModelDb.elements.insertElement(partitionProps);
    const model: ModelProps = {
      classFullName: PhysicalModel.classFullName,
      modeledElement: { id: partitionId },
    };
    return this.iModelDb.models.insertModel(model);
  }
}
