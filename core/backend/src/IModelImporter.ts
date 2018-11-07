/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Id64Array, Id64String } from "@bentley/bentleyjs-core";
import { BisCodeSpec, CategoryProps, CategorySelectorProps, ColorDef, CreateIModelProps, DisplayStyleProps, ElementProps, IModel, InformationPartitionElementProps, ModelSelectorProps, RelatedElement, SubCategoryAppearance, ViewFlags } from "@bentley/imodeljs-common";
import { DrawingCategory, SpatialCategory } from "./Category";
import { DefinitionPartition, DocumentPartition, Drawing, PhysicalPartition } from "./Element";
import { IModelDb } from "./IModelDb";
import { ElementRefersToElements } from "./LinkTableRelationship";
import { DefinitionModel, DocumentListModel, DrawingModel, PhysicalModel } from "./Model";
import { CategorySelector, DisplayStyle2d, DisplayStyle3d, ModelSelector } from "./ViewDefinition";

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
   * Create a parent/child relationship.
   * @param parentId The Id64 of the parent element.
   * @param relClassName The optional relationship class name which (if provided) must be a subclass of BisCore:ElementOwnsChildElements.
   */
  public createParentRelationship(parentId: Id64String, relClassName: string = "BisCore:ElementOwnsChildElements"): RelatedElement {
    return new RelatedElement({ id: parentId, relClassName });
  }
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
   * Insert a new DrawingCategory
   * @param definitionModelId Insert the new DrawingCategory into this DefinitionModel
   * @param name The name of the DrawingCategory
   * @param appearance The appearance settings to use for the default SubCategory of this DrawingCategory
   * @returns The Id of the newly inserted DrawingCategory element.
   */
  public insertDrawingCategory(definitionModelId: Id64String, name: string, _appearance: SubCategoryAppearance): Id64String {
    const categoryProps: CategoryProps = {
      classFullName: DrawingCategory.classFullName,
      model: definitionModelId,
      code: DrawingCategory.createCode(this.iModelDb, definitionModelId, name),
      isPrivate: false,
    };
    return this.iModelDb.elements.insertElement(categoryProps);
    // WIP: Also set the SubCategoryAppearance
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
      isPrivate: false,
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
      isPrivate: false,
    };
    return this.iModelDb.elements.insertElement(categorySelectorProps);
  }
  /**
   * Insert a DisplayStyle3d for use by a ViewDefinition.
   * @param definitionModelId Insert the new DisplayStyle3d into this DefinitionModel
   * @param name The name of the DisplayStyle3d
   * @returns The Id of the newly inserted DisplayStyle3d element.
   */
  public insertDisplayStyle3d(definitionModelId: Id64String, name: string): Id64String {
    const displayStyleProps: DisplayStyleProps = {
      classFullName: DisplayStyle3d.classFullName,
      code: { spec: this.iModelDb.codeSpecs.getByName(BisCodeSpec.displayStyle).id, scope: definitionModelId, value: name },
      model: definitionModelId,
      isPrivate: false,
      backgroundColor: new ColorDef(),
      monochromeColor: ColorDef.white,
      viewFlags: ViewFlags.createFrom(),
    };
    return this.iModelDb.elements.insertElement(displayStyleProps);
  }
  /**
   * Insert a DisplayStyle2d for use by a ViewDefinition.
   * @param definitionModelId Insert the new DisplayStyle2d into this DefinitionModel
   * @param name The name of the DisplayStyle2d
   * @returns The Id of the newly inserted DisplayStyle2d element.
   */
  public insertDisplayStyle2d(definitionModelId: Id64String, name: string): Id64String {
    const displayStyleProps: DisplayStyleProps = {
      classFullName: DisplayStyle2d.classFullName,
      code: { spec: this.iModelDb.codeSpecs.getByName(BisCodeSpec.displayStyle).id, scope: definitionModelId, value: name },
      model: definitionModelId,
      isPrivate: false,
      backgroundColor: new ColorDef(),
      monochromeColor: ColorDef.white,
      viewFlags: ViewFlags.createFrom(),
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
      model: IModel.repositoryModelId,
      parent: this.createParentRelationship(parentSubjectId, "BisCore:SubjectOwnsPartitionElements"),
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
      model: IModel.repositoryModelId,
      parent: this.createParentRelationship(parentSubjectId, "BisCore:SubjectOwnsPartitionElements"),
      code: PhysicalPartition.createCode(this.iModelDb, parentSubjectId, name),
    };
    const partitionId: Id64String = this.iModelDb.elements.insertElement(partitionProps);
    const model: PhysicalModel = this.iModelDb.models.createModel({
      classFullName: PhysicalModel.classFullName,
      modeledElement: { id: partitionId },
    }) as PhysicalModel;
    return this.iModelDb.models.insertModel(model);
  }
  /**
   * Insert a DocumentListModel
   * @param parentSubjectId The DocumentPartition will be inserted as a child of this Subject element.
   * @param name The name of the DocumentPartition that the new DocumentListModel will break down.
   * @returns The Id of the newly inserted DocumentListModel.
   */
  public insertDocumentListModel(parentSubjectId: Id64String, name: string): Id64String {
    const partitionProps: InformationPartitionElementProps = {
      classFullName: DocumentPartition.classFullName,
      model: IModel.repositoryModelId,
      parent: this.createParentRelationship(parentSubjectId, "BisCore:SubjectOwnsPartitionElements"),
      code: DocumentPartition.createCode(this.iModelDb, parentSubjectId, name),
    };
    const partitionId: Id64String = this.iModelDb.elements.insertElement(partitionProps);
    const model: DocumentListModel = this.iModelDb.models.createModel({
      classFullName: DocumentListModel.classFullName,
      modeledElement: { id: partitionId },
    }) as DocumentListModel;
    return this.iModelDb.models.insertModel(model);
  }
  /**
   * Insert a Drawing element and a DrawingModel that breaks it down.
   * @param documentListModelId Insert the new Drawing into this DocumentListModel
   * @param name The name of the Drawing.
   * @returns The Id of the newly inserted Drawing element and the DrawingModel that breaks it down (same value).
   */
  public insertDrawing(documentListModelId: Id64String, name: string): Id64String {
    const drawingProps: ElementProps = {
      classFullName: Drawing.classFullName,
      model: documentListModelId,
      code: Drawing.createCode(this.iModelDb, documentListModelId, name),
    };
    const drawingId: Id64String = this.iModelDb.elements.insertElement(drawingProps);
    const model: DrawingModel = this.iModelDb.models.createModel({
      classFullName: DrawingModel.classFullName,
      modeledElement: { id: drawingId },
    }) as DrawingModel;
    return this.iModelDb.models.insertModel(model);
  }
  /**
   * Insert a relationship between a DrawingGraphic and the Element that it represents.
   * @param drawingGraphicId The Id of the DrawingGraphic
   * @param elementId the Id of the Element that the DrawingGraphic represents
   * @returns The Id of the newly inserted LinkTableRelationship instance.
   */
  public insertDrawingGraphicRepresentsElement(drawingGraphicId: Id64String, elementId: Id64String): Id64String {
    return this.iModelDb.linkTableRelationships.insertInstance(
      ElementRefersToElements.create(this.iModelDb, drawingGraphicId, elementId, "BisCore:DrawingGraphicRepresentsElement"),
    );
  }
}
