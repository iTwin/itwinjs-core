/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64, Id64String, IModelStatus, Logger } from "@bentley/bentleyjs-core";
import { IModelDb, IModelTransformer, DefinitionContainer, DefinitionElement } from "../imodeljs-backend";
import { IModel, IModelError } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { DefinitionContainerName } from "./TestDataConstants";
import { StandardDefinitionManager } from "./StandardDefinitionManager";

/**
 * Handles the physical type import from source (parts db) to
 * target (typically the Design iModel).
 *
 * @note The Engine works with data import, it is suggested to set the target imodel to 'bulkEdit' mode.
 * The Engine doesn't save changes (everything is in the same transaction), and doesn't control locks.
 */
export class PhysicalTypeImportEngine extends IModelTransformer {
  public constructor(source: IModelDb, target: IModelDb) {
    super(source, target);
  }

  /**
 * Exports given physicalType from parts db and imports it into the targetDb.
 * Used for `Place by part number` workflow.
 * @param context AuthorizedClientRequestContext instance.
 * @param sourcePhysicalTypeId Id of the Physical Type to be imported from parts db.
 * @returns Physical Type id of the imported PhysicalType from parts db to target db.
 */
  public async importPhysicalType(context: AuthorizedClientRequestContext, sourcePhysicalTypeId: Id64String): Promise<Id64String | undefined> {
    // TBD: Should the backend verify that the given sourcePhysicalTypeId (part number) is compatible with selected equipment definition or not or should that be handled in the UI only?
    context.enter();

    // Physical Type (main element to import)
    const srcPhysicalTypeDef = this.sourceDb.elements.getElement<DefinitionElement>(sourcePhysicalTypeId, DefinitionElement);

    // Initialize / Remap the main Electrical Parts Container.
    const sourcePhysicalTypeContainerName = this.sourceDb.elements.tryGetElement(srcPhysicalTypeDef.model)?.code.value;
    if (sourcePhysicalTypeContainerName === undefined || sourcePhysicalTypeContainerName !== "Substation Parts")
      throw new IModelError(IModelStatus.NotFound, `Container: Substation Parts.`);

    const targetDefinitionManager = new StandardDefinitionManager(this.targetDb);
    let targetPhysicalTypeContainerId = targetDefinitionManager.tryGetContainerId(sourcePhysicalTypeContainerName);
    if (undefined === targetPhysicalTypeContainerId) {
      const containerCode = targetDefinitionManager.createDefinitionContainerCode(sourcePhysicalTypeContainerName);
      targetPhysicalTypeContainerId = DefinitionContainer.insert(targetDefinitionManager.iModelDb, IModel.dictionaryId, containerCode);
    }
    this.context.remapElement(srcPhysicalTypeDef.model, targetPhysicalTypeContainerId);

    // Initialize / Remap Physical Type.
    let targetPhysicalTypeId: Id64String | undefined = targetDefinitionManager.tryGetPhysicalTypeId(targetPhysicalTypeContainerId, srcPhysicalTypeDef.code.value);
    if (targetPhysicalTypeId === undefined || Id64.invalid === targetPhysicalTypeId) {

      await this.processElement(sourcePhysicalTypeId);
      context.enter();

      targetPhysicalTypeId = this.context.findTargetElementId(sourcePhysicalTypeId);
    }
    this.context.remapElement(sourcePhysicalTypeId, targetPhysicalTypeId);

    return targetPhysicalTypeId;
  }
}
