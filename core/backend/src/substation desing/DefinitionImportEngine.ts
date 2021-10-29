/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64String, IModelStatus } from "@bentley/bentleyjs-core";
import {
  DefinitionContainer, GeometricElement3d, IModelDb, IModelTransformer, Model, PhysicalElementFulfillsFunction, Relationship, SpatialCategory,
} from "../imodeljs-backend";
import { IModel, IModelError, ModelProps } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import {
  ElectricalEquipmentDefinition, ElectricalPhysicalRecipe, ElectricalPhysicalType, FunctionalContainer, PhysicalContainer,
} from "./Element";
import { StandardDefinitionManager } from "./StandardDefinitionManager";

/**
 * Handles the definition import from source (typically Component Definition Catalog Library iModel) to
 * target (typically the Design iModel, containing specific Asset's information).
 *
 * @note The Engine works with data import, it is suggested to set the target imodel to 'bulkEdit' mode.
 * The Engine doesn't save changes (everything is in the same transaction), and doesn't control locks.
 */
export class DefinitionImportEngine extends IModelTransformer {
  private _sourceDefinitionManager: StandardDefinitionManager;
  private _targetDefinitionManager: StandardDefinitionManager;
  private _relationshipsToProcess: { [relName: string]: Id64String[] } = {};

  public constructor(srcDefinitionManager: StandardDefinitionManager, targetDefinitionManager: StandardDefinitionManager) {
    super(srcDefinitionManager.iModelDb, targetDefinitionManager.iModelDb);
    this._sourceDefinitionManager = srcDefinitionManager;
    this._targetDefinitionManager = targetDefinitionManager;
  }

  /** Imports the Equipment Definition.
   *  Handles the partial 'cold start' case (the target DB knows nothing about Catalog Definitions).
   *  If the Definition already exists, will return the id.
   */
  public async importEquipmentDefinition(context: AuthorizedClientRequestContext, equipmentDefinitionId: Id64String): Promise<Id64String> {
    context.enter();

    // Main equipment to import
    const srcEquipDef = this.sourceDb.elements.getElement<ElectricalEquipmentDefinition>(equipmentDefinitionId, ElectricalEquipmentDefinition);

    // Initialize / Remap the main Definition Container.
    const sourceEquipDefContainerName = this._sourceDefinitionManager.getCatalogNameFromContainerId(srcEquipDef.model);

    let targetEquipDefContainerId = this._targetDefinitionManager.tryGetContainerId(sourceEquipDefContainerName);
    if (undefined === targetEquipDefContainerId) {
      const containerCode = this._targetDefinitionManager.createDefinitionContainerCode(sourceEquipDefContainerName);
      targetEquipDefContainerId = DefinitionContainer.insert(this.targetDb, IModel.dictionaryId, containerCode);
    }
    this.context.remapElement(srcEquipDef.model, targetEquipDefContainerId);

    // Initialize / Remap Physical container
    const srcPhysicalContainerId = this._sourceDefinitionManager.getCatalogPhysicalContainerId(srcEquipDef.model);
    const physicalContainerCode = this._targetDefinitionManager.createPhysicalContainerCode(sourceEquipDefContainerName);
    let targetPhysicalContainerId = this.targetDb.elements.queryElementIdByCode(physicalContainerCode);
    if (undefined === targetPhysicalContainerId) {
      targetPhysicalContainerId = PhysicalContainer.insert(this.targetDb, targetEquipDefContainerId, sourceEquipDefContainerName);
    }
    this.context.remapElement(srcPhysicalContainerId, targetPhysicalContainerId);

    // Initialize / Remap Functional container
    const srcFunctionalContainerId = this._sourceDefinitionManager.getCatalogFunctionalContainerId(srcEquipDef.model);
    const functionalContainerCode = this._targetDefinitionManager.createFunctionalContainerCode(sourceEquipDefContainerName);
    let targetFunctionalContainerId = this.targetDb.elements.queryElementIdByCode(functionalContainerCode);
    if (undefined === targetFunctionalContainerId) {
      targetFunctionalContainerId = FunctionalContainer.insert(this.targetDb, targetEquipDefContainerId, sourceEquipDefContainerName);
    }
    this.context.remapElement(srcFunctionalContainerId, targetFunctionalContainerId);

    // Initialize / Remap Equipment Definition
    let targetEquipDefId = this._targetDefinitionManager.tryGetEquipmentDefinitionId(sourceEquipDefContainerName, srcEquipDef.code.value);
    if (undefined === targetEquipDefId) {

      // Source Physical Type
      const physicalType = this.sourceDb.elements.getElement<ElectricalPhysicalType>(srcEquipDef.physicalType.id, ElectricalPhysicalType);
      if (undefined === physicalType.recipe)
        throw new IModelError(IModelStatus.NotFound, "Incorrect Catalog Structure - the Physical Type must contain a TemplateRecipe.");

      // Source recipe element - to look up categories, and existence in target by Code.
      const srcElectricalPhysicalRecipe = this._sourceDefinitionManager.iModelDb.elements.getElement<ElectricalPhysicalRecipe>(physicalType.recipe.id, ElectricalPhysicalRecipe);

      // Handle the GeometricElement's Category (only root for now)
      const srcGeometricElementId = this._sourceDefinitionManager.tryGetTemplateAssemblyId(srcElectricalPhysicalRecipe.id);
      if (undefined === srcGeometricElementId)
        throw new IModelError(IModelStatus.NotFound, "Incorrect Catalog Structure - the TemplateRecipe must contain GeometricElements.");

      await this.processSpatialCategory(srcGeometricElementId, srcEquipDef.model, targetEquipDefContainerId, context);

      // Export the ElectricalPhysicalRecipe if it doesn't exist yet (0..*)
      const electricalPhysicalRecipeId = this._targetDefinitionManager.tryGetTemplateRecipe3dId(sourceEquipDefContainerName, srcElectricalPhysicalRecipe.code.value);
      if (undefined === electricalPhysicalRecipeId) {
        await this.processElement(srcElectricalPhysicalRecipe.id);
        context.enter();

        if (this._targetDefinitionManager.iModelDb.isBriefcaseDb() && this._targetDefinitionManager.iModelDb.allowLocalChanges) {
          await this._targetDefinitionManager.iModelDb.concurrencyControl.request(context);
          context.enter();
        }
        await this.processModel(srcElectricalPhysicalRecipe.id);
        context.enter();

        const targetElectricalPhysicalRecipeId = this.context.findTargetElementId(srcElectricalPhysicalRecipe.id);
      } else {
        this.context.remapElement(physicalType.recipe.id, electricalPhysicalRecipeId);
      }

      await this.processElement(physicalType.id);
      context.enter();

      const physicalDefId = this._sourceDefinitionManager.tryGetCatalogPhysicalDefinitionId(equipmentDefinitionId);
      const functionalDefId = this._sourceDefinitionManager.tryGetCatalogFunctionalDefinitionId(equipmentDefinitionId);
      const relId = this._sourceDefinitionManager.tryGetFuncPhysicalRelByEquipId(equipmentDefinitionId);

      if (undefined === physicalDefId || undefined === functionalDefId || undefined === relId)
        throw new IModelError(IModelStatus.NotFound, "Incorrect Catalog Structure - the definition must contain Physical and Functional elements for Presentation.");

      await this.processSpatialCategory(physicalDefId, srcEquipDef.model, targetEquipDefContainerId, context);
      await this.processElement(physicalDefId);
      await this.processElement(functionalDefId);

      // The transformer doesn't support a single-relationship processing.
      // To mitigate, we manage the 'relationships to export' via `shouldExportRelationship` override.
      this._relationshipsToProcess[PhysicalElementFulfillsFunction.classFullName] = [relId];
      await this.processRelationships(PhysicalElementFulfillsFunction.classFullName);

      // Main ElectricalEquipmentDefinition
      await this.processElement(srcEquipDef.id);
      context.enter();

      targetEquipDefId = this.context.findTargetElementId(srcEquipDef.id);
    }

    return targetEquipDefId;
  }

  private async processSpatialCategory(srcGeometricElementId: Id64String, srcDefContainerId: Id64String, targetDefContainerId: Id64String, context: AuthorizedClientRequestContext) {
    const srcGeometricElement3d = this._sourceDefinitionManager.iModelDb.elements.getElement<GeometricElement3d>(srcGeometricElementId, GeometricElement3d);
    const srcSpatialCategory = this._sourceDefinitionManager.iModelDb.elements.getElement<SpatialCategory>(srcGeometricElement3d.category, SpatialCategory);

    let targetCategoryId = this._targetDefinitionManager.tryGetSpatialCategoryId(srcSpatialCategory.code.value);
    if (undefined === targetCategoryId) {
      // Import the categories into the Dictionary as opposed to he specific Definition Container.
      this.context.removeElement(srcDefContainerId);
      this.context.remapElement(srcDefContainerId, IModelDb.dictionaryId);
      await this.processElement(srcSpatialCategory.id);
      context.enter();
      this.context.removeElement(srcDefContainerId);
      this.context.remapElement(srcDefContainerId, targetDefContainerId);

      targetCategoryId = this.context.findTargetElementId(srcSpatialCategory.id);
    }
    this.context.remapElement(srcSpatialCategory.id, targetCategoryId);
  }

  /** Override of [IModelExportHandler.onExportModel]($backend) that is called when a Model should be exported from the source iModel.
   * This override calls [[onTransformModel]] and then [IModelImporter.importModel]($backend) to update the target iModel.
   */
  protected onExportModel(sourceModel: Model): void {
    if (IModel.repositoryModelId === sourceModel.id) {
      return; // The RepositoryModel should not be directly imported
    }
    const targetModeledElementId: Id64String = this.context.findTargetElementId(sourceModel.id);
    const targetModelProps: ModelProps = this.onTransformModel(sourceModel, targetModeledElementId);
    this.importer.importModel(targetModelProps);
    this.targetDb.saveChanges("Import model");
  }

  /** Override of [IModelExportHandler.shouldExportRelationship]($backend) that is called to determine if a [Relationship]($backend) should be exported.
   * @note Reaching this point means that the relationship has passed the standard exclusion checks in [IModelExporter]($backend).
   */
  protected shouldExportRelationship(_sourceRelationship: Relationship): boolean {
    return (this._relationshipsToProcess[_sourceRelationship.classFullName] !== undefined
      && this._relationshipsToProcess[_sourceRelationship.classFullName].find((id) => id === _sourceRelationship.id) !== undefined);
  }
}

