/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { BackendLoggerCategory, IModelDb, SnapshotDb } from "../imodeljs-backend";
import { Placement3d } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { DefinitionImportEngine } from "./DefinitionImportEngine";
import { EquipmentPlacementEngine } from "./EquipmentPlacementEngine";
import { PhysicalTypeImportEngine } from "./PhysicalTypeImportEngine";
import { StandardDefinitionManager } from "./StandardDefinitionManager";
import { DefinitionContainerName } from "./TestDataConstants";

export interface PartsProps {
  /** File path of the parts db (*.bim) */
  partsDbPath: string;
  /** Physical type id */
  physicalTypeId: Id64String;
}

/*
 * Properties for importing the definition and placing an element.
 */
export interface EquipmentPlacementProps {
  /** Equipment Definition Id in the Catalog Database.
   * The definition will be imported to the target (current) database if it doesn't exist yet. */
  equipmentDefinitionId: string;
  /** Path to the Component Definition Catalog Database (bim file). */
  catalogDbPath: string;

  /** Physical model id to place Physical elements in the target (current) database. */
  physicalModelId: string;
  /** Functional model id to place Functional elements in the target (current) database. */
  functionalModelId: string;
  /** Drawing model id to place Drawing elements in the target (current) database. */
  drawingModelId: string;

  /** Placement position of the new element. */
  placement: Placement3d;

  /** CodeValue to be used for the Physical / Functional instances. */
  codeValue?: string;

  /** Physical type id and file path of the parts db, to place Physical elements with given properties in the target (current) database. */
  partsProps?: PartsProps;
}

/**
 * Equipment Placement Service ties together Definition Importer and Equipment Placer (see DefinitionImportEngine, EquipmentPlacementEngine).
 * Connection to Catalog database is created or reused if already opened.
 *
 * @note The service works with data import, it is suggested to set the target imodel to 'bulkEdit' mode.
 * The service doesn't save changes (everything is in the same transaction), and doesn't control locks.
 */
export class EquipmentPlacementService {
  /*
   * Provisions the specified database with Catalog Data
   */
  public static async placeEquipment(context: AuthorizedClientRequestContext, targetDb: IModelDb, equipmentPlacementProps: EquipmentPlacementProps): Promise<Id64String> {

    // TODO: this shouldn't really be here - need to figure out how to control logging from the 'main' start point.
    // For now this will do.
    // Logger.initializeToConsole();
    // Logger.setLevelDefault(LogLevel.Error);
    // Logger.setLevel(AppLoggerCategory.BackendEquipmentPlacementService, LogLevel.Trace);
    // Logger.setLevel(AppLoggerCategory.BackendDefinitionImportEngine, LogLevel.Trace);
    // Logger.setLevel(AppLoggerCategory.BackendEquipmentPlacementEngine, LogLevel.Trace);

    // To turn on full details on Transformer libs.
    if (false) {
      Logger.setLevel(BackendLoggerCategory.IModelExporter, LogLevel.Trace);
      Logger.setLevel(BackendLoggerCategory.IModelImporter, LogLevel.Trace);
      Logger.setLevel(BackendLoggerCategory.IModelTransformer, LogLevel.Trace);
    }

    context.enter();

    // Establish connectivity to the catalog database.
    const srcDbPath = equipmentPlacementProps.catalogDbPath;
    const srcDb = IModelDb.tryFindByKey(srcDbPath) ?? SnapshotDb.openFile(srcDbPath);
    const srcDefManager = new StandardDefinitionManager(srcDb);

    const targetDefManager: StandardDefinitionManager = new StandardDefinitionManager(targetDb);
    const definitionImporter = new DefinitionImportEngine(srcDefManager, targetDefManager);

    const equipmentPlacer = new EquipmentPlacementEngine(targetDefManager, targetDefManager, equipmentPlacementProps.physicalModelId, equipmentPlacementProps.functionalModelId, equipmentPlacementProps.drawingModelId);

    // Import equipment definition.
    const equipDefId = await definitionImporter.importEquipmentDefinition(context, equipmentPlacementProps.equipmentDefinitionId);
    context.enter();
    definitionImporter.dispose();

    // Import physical type (used for `Place by part number` workflow).
    let electricalPhysicalTypeId: Id64String | undefined;
    if (equipmentPlacementProps.partsProps) {
      const { partsDbPath, physicalTypeId } = equipmentPlacementProps.partsProps;
      const partsDb: IModelDb = IModelDb.tryFindByKey(partsDbPath) ?? SnapshotDb.openFile(partsDbPath);
      const physicalTypeImporter = new PhysicalTypeImportEngine(partsDb, targetDb);

      electricalPhysicalTypeId = await physicalTypeImporter.importPhysicalType(context, physicalTypeId);
      context.enter();
      physicalTypeImporter.dispose();
    }

    // Place equipment in target db.
    const instanceId = await equipmentPlacer.placeEquipmentInstance(equipDefId, equipmentPlacementProps.placement, electricalPhysicalTypeId, equipmentPlacementProps.codeValue);
    context.enter();

    return instanceId;
  }

  // For testing
  public static getEquipmentDefinitionIdByName(equipmentName: string, iModelDb: IModelDb): Id64String {
    const defManager: StandardDefinitionManager = new StandardDefinitionManager(iModelDb);
    const equipmentTemplateId = defManager.tryGetEquipmentDefinitionId(DefinitionContainerName.SampleEquipmentCatalog, equipmentName);
    return equipmentTemplateId!;
  }
}
