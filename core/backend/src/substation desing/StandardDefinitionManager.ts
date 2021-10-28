/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DbResult, Id64String, IModelStatus } from "@bentley/bentleyjs-core";
import {
  DefinitionContainer, DrawingCategory, ECSqlStatement, IModelDb, PhysicalElementFulfillsFunction, SpatialCategory, TemplateRecipe3d,
} from "../imodeljs-backend";
import { Code, CodeScopeSpec, IModel, IModelError, SubCategoryAppearance } from "@bentley/imodeljs-common";
import { ElectricalEquipmentDefinition, ElectricalPhysicalType, FunctionalContainer, PhysicalContainer } from "./Element";

export enum SubstationClassNames {
  DistributionTransformerPhysicalType = "DistributionTransformerPhysicalType",
  DisconnectingCircuitBreakerPhysicalType = "DisconnectingCircuitBreakerPhysicalType",
  SurgeArresterPhysicalType = "SurgeArresterPhysicalType",

  DistributionTransformer = "DistributionTransformer",
  DisconnectingCircuitBreaker = "DisconnectingCircuitBreaker",
  SurgeArrester = "SurgeArrester",

  DistributionTransformerFunctional = "DistributionTransformerFunctional",
  DisconnectingCircuitBreakerFunctional = "DisconnectingCircuitBreakerFunctional",
  SurgeArresterFunctional = "SurgeArresterFunctional",

}
/** Enum containing the full class names from the Substation schema.
 * @note This is a temporary solution - generally each class should have it's domain class implementation.
 */
export enum SubstationFullClassNames {
  ElectricalEquipmentDefinition = "Substation:ElectricalEquipmentDefinition",

  // Definition - Type relationships
  PhysicalTypeReference = "Substation:PhysicalTypeReference",

  // Types
  ElectricalPhysicalType = "Substation:ElectricalPhysicalType",
  DistributionTransformerPhysicalType = "Substation:DistributionTransformerPhysicalType",
  DisconnectingCircuitBreakerPhysicalType = "Substation:DisconnectingCircuitBreakerPhysicalType",
  SurgeArresterPhysicalType = "Substation:SurgeArresterPhysicalType",

  // Recipes
  ElectricalPhysicalRecipe = "Substation:ElectricalPhysicalRecipe",

  // Physical Recipe contents // Physical geometry-oriented
  ElectricalGeometry3d = "Substation:ElectricalGeometry3d",
  ElectricalAnchorPoint3d = "Substation:ElectricalAnchorPoint3d",

  // Physical/Functional bases
  ElectricalPhysicalEquipment = "Substation:ElectricalPhysicalEquipment",
  ElectricalFunctionalEquipment = "Substation:ElectricalFunctionalEquipment",

  // Physical
  DistributionTransformer = "Substation:DistributionTransformer",
  DisconnectingCircuitBreaker = "Substation:DisconnectingCircuitBreaker",
  SurgeArrester = "Substation:SurgeArrester",

  // Concrete Functional
  DistributionTransformerFunctional = "Substation:DistributionTransformerFunctional",
  DisconnectingCircuitBreakerFunctional = "Substation:DisconnectingCircuitBreakerFunctional",
  SurgeArresterFunctional = "Substation:SurgeArresterFunctional",

  // Aspects
  CompatibleEquipmentDefinition = "Substation:CompatibleEquipmentDefinition",
}

export enum BisFullClassNames {
  PhysicalTypeHasTemplateRecipe = "BisCore:PhysicalTypeHasTemplateRecipe",
}

/** Enum containing the names of the standard CodeSpec created by this domain.
 * @note It is a best practice is to use a namespace to ensure CodeSpec uniqueness.
 */
export enum CodeSpecName {
  DefinitionContainer = "BisCore.DefinitionContainer", // eslint-disable-line no-shadow
  ElectricalEquipment = "Substation:ElectricalEquipment",
  ElectricalEquipmentDefinition = "Substation:ElectricalEquipmentDefinition",
  ElectricalFunctionalEquipment = "Substation:ElectricalFunctionalEquipment",
  ElectricalPhysicalType = "Substation:ElectricalPhysicalType",
  ElectricalPhysicalRecipe = "Substation:ElectricalPhysicalRecipe",
  PhysicalContainer = "Substation:PhysicalContainer",
  FunctionalContainer = "Substation:FunctionalContainer",
  DefinitionGroup = "BisCore:DefinitionGroup",
}

/** Enum containing the names of the standard SpatialCategory elements created by this domain.
 * SpatialCategories are specific to 3d.
 * @note These names are scoped to a specific DefinitionContainer to ensure uniqueness across domains.
 */
export enum SpatialCategoryName {
  Equipment = "Equipment", // for Equipment in a PhysicalModel
  Wire = "Wire", // for Wire in a PhysicalModel
}

/** Enum containing the names of the standard DrawingCategory elements created by this domain.
 * DrawingCategories are specific to 2d.
 * @note These names are scoped to a specific DefinitionContainer to ensure uniqueness across domains.
 */
export enum DrawingCategoryName {
  Notes = "Notes",
  TitleBlock = "TitleBlock",
  Equipment = "Equipment", // for Equipment in a 2d schematic DrawingModel
  Wire = "Wire", // for Wire in a 2d schematic DrawingModel
}

/** Manages the CodeSpecs, categories, and other standard definitions that are always present and required. */
export class StandardDefinitionManager {
  public readonly iModelDb: IModelDb;

  public constructor(iModelDb: IModelDb) {
    this.iModelDb = iModelDb;
  }

  /**
   * Ensures standard definitions (CodeSpecs, Categories) required for Substation domain exist.
   * @param [definitionModelId] definition model where Categories are stored. Defaults to `IModelDb.dictionaryId`.
   */
  public ensureStandardDefinitions(definitionModelId: Id64String = IModelDb.dictionaryId): void {
    this.ensureStandardCodeSpecs();
    this.ensureStandardCategories(definitionModelId);
  }

  /**
   * Ensures standard definitions (CodeSpecs) required for Substation domain parts db.
   * @param iModelDb
   */
  public ensurePartsDbCodeSpecs(iModelDb: IModelDb) {
    // insert a CodeSpec to enforce unique names for DefinitionContainer
    if (!iModelDb.codeSpecs.hasName(CodeSpecName.DefinitionContainer)) {
      iModelDb.codeSpecs.insert(CodeSpecName.DefinitionContainer, CodeScopeSpec.Type.Repository); // CodeValues must be unique within entire repository/iModel
    }
    // insert a CodeSpec to enforce unique names for ElectricalPhysicalType
    if (!iModelDb.codeSpecs.hasName(CodeSpecName.ElectricalPhysicalType)) {
      iModelDb.codeSpecs.insert(CodeSpecName.ElectricalPhysicalType, CodeScopeSpec.Type.Model); // CodeValues must be unique within entire repository/iModel
    }
    // insert a CodeSpec to enforce unique names for DefinitionGroup
    if (!iModelDb.codeSpecs.hasName(CodeSpecName.DefinitionGroup)) {
      iModelDb.codeSpecs.insert(CodeSpecName.DefinitionGroup, CodeScopeSpec.Type.Model); // CodeValues must be unique within a specific Model
    }
  }

  /**
   * Get the Definition Container Id for specified Catalog.
   * @param catalogName Catalog Name.
   * @returns Definition Container Id.
   */
  public tryGetContainerId(catalogName: string): Id64String | undefined {
    return this.iModelDb.elements.queryElementIdByCode(this.createDefinitionContainerCode(catalogName));
  }

  /**
   * Get the Catalog Name for the specified Definition Container Id.
   * @param containerId Definition Container Id.
   * @returns Catalog Name.
   */
  public getCatalogNameFromContainerId(containerId: string): Id64String {
    return this.iModelDb.elements.getElement(containerId).code.value;
  }

  public tryGetSpatialCategoryId(categoryName: string, definitionModelId: string = IModelDb.dictionaryId): Id64String | undefined {
    return this.iModelDb.elements.queryElementIdByCode(SpatialCategory.createCode(this.iModelDb, definitionModelId, categoryName));
  }

  public tryGetDrawingCategoryId(categoryName: string, definitionModelId: string = IModelDb.dictionaryId): Id64String | undefined {
    return this.iModelDb.elements.queryElementIdByCode(DrawingCategory.createCode(this.iModelDb, definitionModelId, categoryName));
  }

  /**
   * Gets the Equipment Definition Id based on it's Name from the specified Catalog.
   * @param catalogName The name of the Catalog. It's equivalent to the Code of the Definition Container.
   * @param equipmentDefinitionName The Name of the Equipment Definition. It's equivalent to the Code of the Equipment Definition.
   * @returns Equipment Definition Id.
   */
  public tryGetEquipmentDefinitionId(catalogName: string, equipmentDefinitionName: string): Id64String | undefined {
    const containerId = this.iModelDb.elements.queryElementIdByCode(this.createDefinitionContainerCode(catalogName));
    return containerId ? this.iModelDb.elements.queryElementIdByCode(ElectricalEquipmentDefinition.createCode(this.iModelDb, containerId, equipmentDefinitionName))
      : undefined;
  }

  /**
   * Gets the Physical Definition Id. We store a physical element instance as part of the definition, used solely for presenting the definitions.
   * The Physical Element should have the same CodeValue as the Equipment Definition.
   * @param equipmentDefinitionId Equipment Definition Id.
   * @returns Physical Element Id used to represent the Equipment Definition.
   */
  public tryGetCatalogPhysicalDefinitionId(equipmentDefinitionId: Id64String): Id64String | undefined {
    const equipDef = this.iModelDb.elements.getElement<ElectricalEquipmentDefinition>(equipmentDefinitionId, ElectricalEquipmentDefinition);
    const defContainer = this.iModelDb.elements.getElement<DefinitionContainer>(equipDef.model, DefinitionContainer);
    const physicalContainerId = this.tryGetPhysicalContainerId(defContainer.code.value);

    return physicalContainerId ? this.iModelDb.elements.queryElementIdByCode(this.createCatalogPhysicalEquipmentCodeById(equipDef.code.value, physicalContainerId))
      : undefined;
  }

  /**
   * Gets the Functional Definition Id. We store a functional element instance as part of the definition, used solely for presenting the definitions.
   * The Functional Element should be related to the Physical Definition Element via `PhysicalElementFulfillsFunction` relationship.
   * @param equipmentDefinitionId Equipment Definition Id.
   * @returns Functional Element Id used to represent the Equipment Definition.
   */
  public tryGetCatalogFunctionalDefinitionId(equipmentDefinitionId: Id64String): Id64String | undefined {
    const physicalEquipId = this.tryGetCatalogPhysicalDefinitionId(equipmentDefinitionId);
    if (!physicalEquipId)
      return undefined;

    const functionalId = this.tryGetFunctionalDefinitionId(physicalEquipId);
    return functionalId;
  }

  /**
   * Gets the Physical Definition Id. We store a physical element instance as part of the definition, used for presenting the definitions.
   * The Physical Element should have the same CodeValue as the Equipment Definition.
   * @param equipmentDefinitionId Equipment Definition Id.
   * @throws [[IModelError]] if the element exists, but cannot be loaded.
   * @returns Physical Element Id used to represent the Equipment Definition.
   */
  public getCatalogPhysicalDefinitionId(equipmentDefinitionId: Id64String): Id64String {
    const physicalId = this.tryGetCatalogPhysicalDefinitionId(equipmentDefinitionId);
    if (undefined === physicalId)
      throw new IModelError(IModelStatus.NotFound, `Element=${physicalId}`);
    return physicalId;
  }

  /**
   * Gets the Functional Definition Id. We store a functional element instance as part of the definition, used for presenting the definitions.
   * The Functional Element should be related to the Physical Definition Element via `PhysicalElementFulfillsFunction` relationship.
   * @param equipmentDefinitionId Equipment Definition Id.
   * @throws [[IModelError]] if the element exists, but cannot be loaded.
   * @returns Functional Element Id used to represent the Equipment Definition.
   */
  public getCatalogFunctionalDefinitionId(equipmentDefinitionId: Id64String): Id64String {
    const functionalId = this.tryGetCatalogFunctionalDefinitionId(equipmentDefinitionId);
    if (undefined === functionalId)
      throw new IModelError(IModelStatus.NotFound, `Element=${functionalId}`);
    return functionalId;
  }

  /**
   * Gets the Physical Container Id. We store a physical element instance as part of the definition, used for presenting the definitions.
   * The Physical Container should have the same CodeValue as the Definition Container.
   * @param definitionContainerId Definition Container Id.
   * @throws [[IModelError]] if the element exists, but cannot be loaded.
   * @returns Physical Element Id used to represent the Equipment Definition.
   */
  public getCatalogPhysicalContainerId(definitionContainerId: Id64String): Id64String {
    const definitionContainer = this.iModelDb.elements.getElement<DefinitionContainer>(definitionContainerId);
    const physicalId = this.tryGetPhysicalContainerId(definitionContainer.code.value);
    if (undefined === physicalId)
      throw new IModelError(IModelStatus.NotFound, `Element=${physicalId}`);
    return physicalId;
  }

  /**
   * Gets the Functional Container Id. We store a functional element instance as part of the definition, used for presenting the definitions.
   * The Functional Container should have the same CodeValue as the Definition Container.
   * @param equipmentDefinitionId Definition Container Id.
   * @throws [[IModelError]] if the element exists, but cannot be loaded.
   * @returns Functional Element Id used to represent the Equipment Definition.
   */
  public getCatalogFunctionalContainerId(definitionContainerId: Id64String): Id64String {
    const definitionContainer = this.iModelDb.elements.getElement<DefinitionContainer>(definitionContainerId);
    const functionalId = this.tryGetFunctionalContainerId(definitionContainer.code.value);
    if (undefined === functionalId)
      throw new IModelError(IModelStatus.NotFound, `Element=${functionalId}`);
    return functionalId;
  }

  /**
   * Gets the `PhysicalElementFulfillsFunction` Id between Definition Physical and Functional elements.
   * @param equipmentDefinitionId Equipment Definition Id.
   * @returns `PhysicalElementFulfillsFunction` Id.
   */
  public tryGetFuncPhysicalRelByEquipId(equipmentDefinitionId: Id64String): Id64String | undefined {
    const physicalEquipId = this.tryGetCatalogPhysicalDefinitionId(equipmentDefinitionId);
    if (!physicalEquipId)
      return undefined;

    const sql = `SELECT ECInstanceId FROM ${PhysicalElementFulfillsFunction.classFullName} WHERE SourceECInstanceId = :physicalId`;
    const relId = this.iModelDb.withPreparedStatement(sql, (statement: ECSqlStatement) => {
      statement.bindId("physicalId", physicalEquipId);
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getId() : undefined;
    });

    return relId;
  }

  /**
   * Gets the TemplateRecipeId used for the specified Equipment Definition in the specified Catalog.
   * @param catalogName Catalog name.
   * @param equipmentDefinitionName Equipment Definition Name.
   * @returns TemplateRecipeId.
   */
  public tryGetTemplateRecipe3dId(catalogName: string, equipmentDefinitionName: string): Id64String | undefined {
    const containerId = this.iModelDb.elements.queryElementIdByCode(this.createDefinitionContainerCode(catalogName));
    return containerId ? this.iModelDb.elements.queryElementIdByCode(TemplateRecipe3d.createCode(this.iModelDb, containerId, equipmentDefinitionName))
      : undefined;
  }

  /**
   * Gets the Assembly Id (top geometric element) from the Template.
   * @param templateId TemplateRecipe Id.
   * @returns Assembly Id.
   */
  public tryGetTemplateAssemblyId(templateId: string): Id64String | undefined {
    const recipeSql = `SELECT ge.ECInstanceId FROM BisCore:GeometricElement ge
                       INNER JOIN BisCore:ModelContainsElements mce ON ge.ECInstanceId = mce.TargetECInstanceId
                       INNER JOIN BisCore:ModelModelsElement mme ON mce.SourceECInstanceId = mme.SourceECInstanceId
                       WHERE mme.TargetECInstanceId=:templateId AND ge.Parent.Id IS NULL`;
    const geometricElementId = this.iModelDb.withPreparedStatement(recipeSql, (statement: ECSqlStatement) => {
      statement.bindId("templateId", templateId);
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getId() : undefined;
    });
    return geometricElementId;
  }

  public createDefinitionContainerCode(value: string): Code {
    const codeSpec = this.iModelDb.codeSpecs.getByName(CodeSpecName.DefinitionContainer);
    return new Code({ spec: codeSpec.id, scope: IModel.rootSubjectId, value }); // scope is root subject for CodeScopeSpec.Type.Repository
  }

  /**
   * Creates Physical Equipment Code within the provided Definition Container (By Code).
   * This assumes the Definition Container will have a Physical Container element which has a Physical Submodel with matching Code.
   * @param physicalEquipCodeValue Code Value for Physical Equipment.
   * @param defContainerCodeValue Code Value of the Definition Container where this Physical Equipment will be stored.
   * @returns Code.
   */
  public createCatalogPhysicalEquipmentCodeByCode(physicalEquipCodeValue: string, defContainerCodeValue: string): Code {
    const physicalContainerId = this.tryGetPhysicalContainerId(defContainerCodeValue)!;

    const codeSpec = this.iModelDb.codeSpecs.getByName(CodeSpecName.ElectricalEquipment);
    return new Code({ spec: codeSpec.id, scope: physicalContainerId, value: physicalEquipCodeValue }); // scope is root subject for CodeScopeSpec.Type.Repository
  }

  /**
   * Creates Physical Equipment Code within the provided Definition Container.
   * @param equipDefinitionCodeValue Code Value for Physical Equipment.
   * @param physicalContainerId Id of the Physical Container where this Physical Equipment will be stored.
   * @returns Code.
   */
  public createCatalogPhysicalEquipmentCodeById(equipDefinitionCodeValue: string, physicalContainerId: Id64String): Code {
    const codeSpec = this.iModelDb.codeSpecs.getByName(CodeSpecName.ElectricalEquipment);
    return new Code({ spec: codeSpec.id, scope: physicalContainerId, value: equipDefinitionCodeValue }); // scope is root subject for CodeScopeSpec.Type.Repository
  }

  /**
   * Creates physical container code for provided Catalog Name.
   * It assumes the Catalog's Definition Container with matching name was already initialized.
   * @param catalogName Catalog Name.
   * @returns Code for PhysicalContainer.
   */
  public createPhysicalContainerCode(catalogName: string): Code {
    const defContainerId = this.tryGetContainerId(catalogName);
    if (!defContainerId) {
      throw new IModelError(IModelStatus.NotFound, `Definition Container with ${catalogName} not found.`);
    }
    return PhysicalContainer.createCode(this.iModelDb, defContainerId, catalogName);
  }

  /**
   * Creates functional container code for provided Catalog Name.
   * It assumes the Catalog's Definition Container with matching name was already initialized.
   * @param catalogName Catalog Name.
   * @returns Code for FunctionalContainer.
   */
  public createFunctionalContainerCode(catalogName: string): Code {
    const defContainerId = this.tryGetContainerId(catalogName);
    if (!defContainerId) {
      throw new IModelError(IModelStatus.NotFound, `Definition Container with ${catalogName} not found.`);
    }
    return FunctionalContainer.createCode(this.iModelDb, defContainerId, catalogName);
  }

  public createDefinitionGroupCode(definitionModelId: Id64String, codeValue: string): Code {
    const codeSpec = this.iModelDb.codeSpecs.getByName(CodeSpecName.DefinitionGroup);
    const defGroupCode = new Code({ spec: codeSpec.id, scope: definitionModelId, value: codeValue });
    return defGroupCode;
  }

  public ensureStandardCodeSpecs(): void {
    // insert a CodeSpec to enforce unique names for DefinitionContainers
    if (!this.iModelDb.codeSpecs.hasName(CodeSpecName.DefinitionContainer)) {
      this.iModelDb.codeSpecs.insert(CodeSpecName.DefinitionContainer, CodeScopeSpec.Type.Repository); // CodeValues must be unique within entire repository/iModel
    }
    // insert a CodeSpec to enforce unique names for PhysicalContainers
    if (!this.iModelDb.codeSpecs.hasName(CodeSpecName.PhysicalContainer)) {
      this.iModelDb.codeSpecs.insert(CodeSpecName.PhysicalContainer, CodeScopeSpec.Type.Model); // CodeValues must be unique within a specific Model
    }
    // insert a CodeSpec to enforce unique names for FunctionalContainers
    if (!this.iModelDb.codeSpecs.hasName(CodeSpecName.FunctionalContainer)) {
      this.iModelDb.codeSpecs.insert(CodeSpecName.FunctionalContainer, CodeScopeSpec.Type.Model); // CodeValues must be unique within a specific Model
    }
    // insert a CodeSpec to enforce unique names for EquipmentDefinitions
    if (!this.iModelDb.codeSpecs.hasName(CodeSpecName.ElectricalEquipmentDefinition)) {
      this.iModelDb.codeSpecs.insert(CodeSpecName.ElectricalEquipmentDefinition, CodeScopeSpec.Type.Model); // CodeValues must be unique within a specific Model
    }
    // insert a CodeSpec to enforce unique names for Equipment
    if (!this.iModelDb.codeSpecs.hasName(CodeSpecName.ElectricalEquipment)) {
      this.iModelDb.codeSpecs.insert(CodeSpecName.ElectricalEquipment, CodeScopeSpec.Type.Model); // CodeValues must be unique within a specific Model
    }
    // insert a CodeSpec to enforce unique names for FunctionalEquipment
    if (!this.iModelDb.codeSpecs.hasName(CodeSpecName.ElectricalFunctionalEquipment)) {
      this.iModelDb.codeSpecs.insert(CodeSpecName.ElectricalFunctionalEquipment, CodeScopeSpec.Type.Model); // CodeValues must be unique within entire repository/iModel
    }
    // insert a CodeSpec to enforce unique names for ElectricalPhysicalType
    if (!this.iModelDb.codeSpecs.hasName(CodeSpecName.ElectricalPhysicalType)) {
      this.iModelDb.codeSpecs.insert(CodeSpecName.ElectricalPhysicalType, CodeScopeSpec.Type.Model); // CodeValues must be unique within entire repository/iModel
    }
    // insert a CodeSpec to enforce unique names for ElectricalPhysicalRecipe
    if (!this.iModelDb.codeSpecs.hasName(CodeSpecName.ElectricalPhysicalRecipe)) {
      this.iModelDb.codeSpecs.insert(CodeSpecName.ElectricalPhysicalRecipe, CodeScopeSpec.Type.Model); // CodeValues must be unique within entire repository/iModel
    }
    // insert a CodeSpec to enforce unique names for DefinitionGroup
    if (!this.iModelDb.codeSpecs.hasName(CodeSpecName.DefinitionGroup)) {
      this.iModelDb.codeSpecs.insert(CodeSpecName.DefinitionGroup, CodeScopeSpec.Type.Model); // CodeValues must be unique within a specific Model
    }
    // insert a CodeSpec to enforce unique names for PhysicalContainer
    if (!this.iModelDb.codeSpecs.hasName(CodeSpecName.PhysicalContainer)) {
      this.iModelDb.codeSpecs.insert(CodeSpecName.PhysicalContainer, CodeScopeSpec.Type.Model); // CodeValues must be unique within a specific Model
    }
    // insert a CodeSpec to enforce unique names for FunctionalContainer
    if (!this.iModelDb.codeSpecs.hasName(CodeSpecName.FunctionalContainer)) {
      this.iModelDb.codeSpecs.insert(CodeSpecName.FunctionalContainer, CodeScopeSpec.Type.Model); // CodeValues must be unique within a specific Model
    }
  }

  /**
   * Ensures standard categories used by Substation exist in the specified Definition Model.
   * @param [definitionModelId] where the Categories are stored. Defaults to `IModelDb.dictionaryId`.
   */
  private ensureStandardCategories(definitionModelId: Id64String = IModelDb.dictionaryId): void {
    // the standard SpatialCategories
    this.ensureSpatialCategory(definitionModelId, SpatialCategoryName.Equipment, new SubCategoryAppearance());
    this.ensureSpatialCategory(definitionModelId, SpatialCategoryName.Wire, new SubCategoryAppearance());

    // the standard DrawingCategories
    this.ensureDrawingCategory(definitionModelId, DrawingCategoryName.Notes, new SubCategoryAppearance());
    this.ensureDrawingCategory(definitionModelId, DrawingCategoryName.TitleBlock, new SubCategoryAppearance());
    this.ensureDrawingCategory(definitionModelId, DrawingCategoryName.Equipment, new SubCategoryAppearance());
    this.ensureDrawingCategory(definitionModelId, DrawingCategoryName.Wire, new SubCategoryAppearance());

    // Each Equipment Type should get a separate category. Avoid the ecschema-metadata dependency for now, and read class names from Db.
    // This gets all ECClassDefs that come from Substation Schema and have `ElectricalPhysicalEquipment` in the class hierarchy.
    const sql = `SELECT cd.Name FROM meta.ECClassDef cd
                 INNER JOIN meta.ECSchemaDef sd ON cd.Schema.Id = sd.ECInstanceId AND sd.Name = 'Substation'
                 INNER JOIN meta.ClassHasAllBaseClasses abc ON cd.ECInstanceId = abc.SourceECInstanceId
                 INNER JOIN meta.ECClassDef cdb ON abc.TargetECInstanceId = cdb.ECInstanceId AND cdb.Name = 'ElectricalPhysicalEquipment'`;
    const classNames: string[] = this.iModelDb.withPreparedStatement(sql, (statement: ECSqlStatement) => {
      const res: string[] = [];
      while (DbResult.BE_SQLITE_ROW === statement.step()) {
        res.push(statement.getValue(0).getString());
      }
      return res;
    });

    classNames.forEach((category: string) => {
      this.ensureSpatialCategory(definitionModelId, category, new SubCategoryAppearance());
    });
  }

  private ensureSpatialCategory(defModelId: Id64String, categoryName: string, appearance: SubCategoryAppearance): Id64String {
    const categoryId = this.iModelDb.elements.queryElementIdByCode(SpatialCategory.createCode(this.iModelDb, defModelId, categoryName));
    return categoryId ?? SpatialCategory.insert(this.iModelDb, defModelId, categoryName, appearance);
  }

  private ensureDrawingCategory(defModelId: Id64String, categoryName: string, appearance: SubCategoryAppearance): Id64String {
    const categoryId = this.iModelDb.elements.queryElementIdByCode(DrawingCategory.createCode(this.iModelDb, defModelId, categoryName));
    return categoryId ?? DrawingCategory.insert(this.iModelDb, defModelId, categoryName, appearance);
  }

  /**
   * Get the Physical Container Id for specified Catalog.
   * @param catalogName Catalog Name.
   * @returns Physical Container Id.
   */
  private tryGetPhysicalContainerId(catalogName: string): Id64String | undefined {
    return this.iModelDb.elements.queryElementIdByCode(this.createPhysicalContainerCode(catalogName));
  }
  /**
   * Get the Functional Container Id for specified Catalog.
   * @param catalogName Catalog Name.
   * @returns Functional Container Id.
   */
  private tryGetFunctionalContainerId(catalogName: string): Id64String | undefined {
    return this.iModelDb.elements.queryElementIdByCode(this.createFunctionalContainerCode(catalogName));
  }

  /**
   * Get the Physical Type id for specified code value.
   * @param containerId The Id of the [DefinitionModel]($backend) that contains this ElectricalPhysicalType element.
   * @param codeValue Name.
   * @returns Id of the Physical Type element for given name (code value).
   */
  public tryGetPhysicalTypeId(containerId: string, codeValue: string): Id64String | undefined {
    return this.iModelDb.elements.queryElementIdByCode(ElectricalPhysicalType.createCode(this.iModelDb, containerId, codeValue));
  }

  /**
   * Gets the Functional Definition Id. We store a functional element instance as part of the definition, used solely for presenting the definitions.
   * The Functional Element should be related to the Physical Definition Element via `PhysicalElementFulfillsFunction` relationship.
   * @param physicalEquipId Physical Definition Element Id.
   * @returns Functional Element Id used to represent the Equipment Definition.
   */
  public tryGetFunctionalDefinitionId(physicalEquipId: Id64String): Id64String | undefined {
    const sql = `SELECT TargetECInstanceId FROM ${PhysicalElementFulfillsFunction.classFullName} WHERE SourceECInstanceId = :physicalId`;
    const functionalId = this.iModelDb.withPreparedStatement(sql, (statement: ECSqlStatement) => {
      statement.bindId("physicalId", physicalEquipId);
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getId() : undefined;
    });

    return functionalId;
  }
}
