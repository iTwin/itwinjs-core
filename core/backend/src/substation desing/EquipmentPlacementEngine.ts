/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DbResult, Id64String, IModelStatus } from "@bentley/bentleyjs-core";
import {
  ECSqlStatement, FunctionalElement, GeometricElement3d, IModelDb, PhysicalElement, PhysicalElementFulfillsFunction, TemplateModelCloner,
} from "../imodeljs-backend";
import { Code, IModelError, PhysicalElementProps, Placement3d } from "@bentley/imodeljs-common";
import { ElectricalEquipmentDefinition, ElectricalFunctionalEquipment, ElectricalPhysicalEquipment, ElectricalPhysicalType } from "./Element";
import { SpatialCategoryName, StandardDefinitionManager, SubstationFullClassNames } from "./StandardDefinitionManager";

/**
 * Handles the Equipment Placement. It assumes the required Definitions already exist (see DefinitionImportEngine)
 * in the iModel. The 'placement' will create a new 'set of instances' (create Functional/Physical Elements, Relationships, etc).
 *
 * The placement relies on Substation Domain logic and follows Electrical schema information hierarchy.
 *
 * @note The Engine works with data import, it is suggested to set the target imodel to 'bulkEdit' mode.
 * The Engine doesn't save changes (everything is in the same transaction), and doesn't control locks.
 */
export class EquipmentPlacementEngine extends TemplateModelCloner {
  private _srcDefManager: StandardDefinitionManager;
  private _targetDefManager: StandardDefinitionManager;
  private _physicalModelId: Id64String;
  private _functionalModelId: Id64String;
  private _drawingModelId: Id64String;

  public constructor(srcDefManager: StandardDefinitionManager, targetDefManager: StandardDefinitionManager, physicalModelId: Id64String, functionalModelId: Id64String, drawingModelId: Id64String) {
    super(targetDefManager.iModelDb, targetDefManager.iModelDb); // cloned Equipment instances will be in the same iModel as the EquipmentDefinition
    this._srcDefManager = srcDefManager;
    this._targetDefManager = targetDefManager;
    this._physicalModelId = physicalModelId;
    this._functionalModelId = functionalModelId;
    this._drawingModelId = drawingModelId;
  }

  public async placeEquipmentInstance(equipmentDefinitionId: Id64String, placement: Placement3d,
    newPhysicalTypeId: Id64String | undefined, codeValue?: string): Promise<Id64String> {
    const equipmentDefinition = this.sourceDb.elements.getElement<ElectricalEquipmentDefinition>(equipmentDefinitionId, ElectricalEquipmentDefinition);
    const electricalPhysicalType = this.sourceDb.elements.getElement<ElectricalPhysicalType>(equipmentDefinition.physicalType.id, ElectricalPhysicalType);

    // The same 'generic' PhysicalType can map to multiple recipes/definitions. We ensure that each Definition will map to only 1 Physical 'presentation' element.
    const presentationFuncElementId = this._srcDefManager.getCatalogFunctionalDefinitionId(equipmentDefinitionId);
    const presentationFuncElement = this.sourceDb.elements.getElement<FunctionalElement>(presentationFuncElementId, FunctionalElement) as ElectricalFunctionalEquipment;

    const physicalTemplateId = electricalPhysicalType.recipe?.id;

    // create the physical equipment by cloning/placing a template
    let physicalInstanceId: Id64String | undefined;
    if (physicalTemplateId) {
      const sourceId = this.findTopGeometricElement3dInstanceIdAndCategoryId(physicalTemplateId, this.sourceDb);
      const categoryName = electricalPhysicalType.physicalClassName.split(":")[1];
      // Support having Categories in either the DictionaryModel or the DefinitionContainer
      const srcCategoryId = this._srcDefManager.tryGetSpatialCategoryId(SpatialCategoryName.Equipment) ?? this._srcDefManager.tryGetSpatialCategoryId(SpatialCategoryName.Equipment, equipmentDefinition.model);
      const adjustedCategoryId = this._targetDefManager.tryGetSpatialCategoryId(categoryName) ?? this._targetDefManager.tryGetSpatialCategoryId(categoryName, equipmentDefinition.model);

      if (undefined === srcCategoryId)
        throw new IModelError(IModelStatus.NotFound, `Category '${SpatialCategoryName.Equipment}' not found in target db.`);
      if (undefined === adjustedCategoryId)
        throw new IModelError(IModelStatus.NotFound, `Category '${categoryName}' not found in target db.`);

      this.context.remapElement(srcCategoryId, adjustedCategoryId); // map category of definition to category of instance - in this case the same

      // Physical type element used for `Place by part number` workflow.
      const electricalPhysicalTypeFromPartsDb: ElectricalPhysicalType | undefined = newPhysicalTypeId === undefined ?
        undefined : this.sourceDb.elements.getElement<ElectricalPhysicalType>(newPhysicalTypeId, ElectricalPhysicalType);

      const targetEquipProps: PhysicalElementProps = {
        classFullName: electricalPhysicalType.physicalClassName,
        model: this._physicalModelId,
        category: adjustedCategoryId,
        code: Code.createEmpty(),
        typeDefinition: electricalPhysicalTypeFromPartsDb ?? electricalPhysicalType,
      };

      const targetEquipId: Id64String = this.targetDb.elements.insertElement(targetEquipProps);
      this.context.remapElement(sourceId, targetEquipId); // set the PhysicalElement with correct class as the target.

      const idMap = await super.placeTemplate3d(physicalTemplateId, this._physicalModelId, placement);
      for (const clonedInstanceId of idMap.values()) {
        const clonedInstance = this.targetDb.elements.tryGetElement<PhysicalElement>(clonedInstanceId, PhysicalElement);
        if (clonedInstance && undefined === clonedInstance.parent) { // The codeValue applies to the "lead" PhysicalElement (will have a null parent indicating that it is not a child)
          physicalInstanceId = clonedInstance.id;

          // 'Placing' the TemplateRecipe on an existing element resets some of the properties, set them back.
          clonedInstance.category = adjustedCategoryId;
          clonedInstance.code = codeValue
            ? ElectricalPhysicalEquipment.createCode(this.targetDb, this._physicalModelId, codeValue)
            : Code.createEmpty();
          clonedInstance.update();

          this.updateChildHierarchy(clonedInstance.id, adjustedCategoryId);
        }
      }
    }
    // create the functional equipment
    const functionalClassFullName = presentationFuncElement.classFullName;
    if (functionalClassFullName) {
      const functionalInstanceId = this.targetDb.elements.insertElement({
        classFullName: functionalClassFullName,
        model: this._functionalModelId,
        code: codeValue ? ElectricalFunctionalEquipment.createCode(this.targetDb, this._functionalModelId, codeValue) : Code.createEmpty(),
      });
      if (physicalInstanceId) {
        this.targetDb.relationships.insertInstance({
          classFullName: PhysicalElementFulfillsFunction.classFullName,
          sourceId: physicalInstanceId,
          targetId: functionalInstanceId,
        });
      }
    }
    if (undefined === physicalInstanceId)
      throw new IModelError(IModelStatus.NotFound, `Failed to place the element for template ${equipmentDefinitionId}`);

    return physicalInstanceId;
  }

  /**
   * For a given Element, updates all child element's categories (including multiple levels). Recursive.
   * @param elemId The Id of Parent element (assembly).
   * @param categoryId CategoryId to set.
   */
  private updateChildHierarchy(elemId: Id64String, categoryId: Id64String): void {
    const childElements = this.targetDb.elements.queryChildren(elemId);
    childElements.forEach((childId) => {
      const el = this.targetDb.elements.getElement<GeometricElement3d>(childId, GeometricElement3d);
      el.category = categoryId;
      el.update();

      // cascade down the hierarchy
      this.updateChildHierarchy(el.id, categoryId);
    });
  }

  private findTopGeometricElement3dInstanceIdAndCategoryId(templateRecipeId: Id64String, iModelDb: IModelDb): Id64String {
    // Start at the 'template' physical element, traverse up to TemplateRecipe (so we know it's not a 'real' instance).
    // Filter out any child-elements within the template container.
    const sql = `SELECT ge.ECInstanceId FROM ${SubstationFullClassNames.ElectricalGeometry3d} ge
                       INNER JOIN BisCore:ModelContainsElements mce ON ge.ECInstanceId = mce.TargetECInstanceId
                       INNER JOIN ${SubstationFullClassNames.ElectricalPhysicalRecipe} tr ON mce.SourceECInstanceId = tr.ECInstanceId
                       WHERE tr.ECInstanceId = :templateRecipeId AND ge.Parent.Id IS NULL`;
    const instanceId = iModelDb.withPreparedStatement(sql, (statement: ECSqlStatement) => {
      statement.bindId("templateRecipeId", templateRecipeId);
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getId() : undefined;
    });

    if (undefined === instanceId)
      throw new IModelError(IModelStatus.NotFound, "Invalid catalog structure - the TemplateRecipe must have a modeled element.");

    return instanceId;
  }
}
