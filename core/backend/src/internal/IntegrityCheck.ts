/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64String, IModelStatus } from "@itwin/core-bentley";
import { IModelError } from "@itwin/core-common";
import { IModelDb } from "../IModelDb";

/**
 * Information about each integrity check type, including the name, expected result type, and SQL query to execute
 * @internal
 */
export const integrityCheckTypeMap = {
  checkDataColumns: {
    name: "Check Data Columns",
    resultType: "CheckDataColumnsResultRow",
    sqlCommand: "check_data_columns",
    sqlQuery: `PRAGMA integrity_check(check_data_columns) ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`,
  },
  checkECProfile: {
    name: "Check EC Profile",
    resultType: "CheckECProfileResultRow",
    sqlCommand: "check_ec_profile",
    sqlQuery: `PRAGMA integrity_check(check_ec_profile) ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`,
  },
  checkNavigationClassIds: {
    name: "Check Navigation Class Ids",
    resultType: "CheckNavClassIdsResultRow",
    sqlCommand: "check_nav_class_ids",
    sqlQuery: `PRAGMA integrity_check(check_nav_class_ids) ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`,
  },
  checkNavigationIds: {
    name: "Check Navigation Ids",
    resultType: "CheckNavIdsResultRow",
    sqlCommand: "check_nav_ids",
    sqlQuery: `PRAGMA integrity_check(check_nav_ids) ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`,
  },
  checkLinktableForeignKeyClassIds: {
    name: "Check Link Table Foreign Key Class Ids",
    resultType: "CheckLinkTableFkClassIdsResultRow",
    sqlCommand: "check_linktable_fk_class_ids",
    sqlQuery: `PRAGMA integrity_check(check_linktable_fk_class_ids) ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`,
  },
  checkLinktableForeignKeyIds: {
    name: "Check Link Table Foreign Key Ids",
    resultType: "CheckLinkTableFkIdsResultRow",
    sqlCommand: "check_linktable_fk_ids",
    sqlQuery: `PRAGMA integrity_check(check_linktable_fk_ids) ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`,
  },
  checkClassIds: {
    name: "Check Class Ids",
    resultType: "CheckClassIdsResultRow",
    sqlCommand: "check_class_ids",
    sqlQuery: `PRAGMA integrity_check(check_class_ids) ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`,
  },
  checkDataSchema: {
    name: "Check Data Schema",
    resultType: "CheckDataSchemaResultRow",
    sqlCommand: "check_data_schema",
    sqlQuery: `PRAGMA integrity_check(check_data_schema) ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`,
  },
  checkSchemaLoad: {
    name: "Check Schema Load",
    resultType: "CheckSchemaLoadResultRow",
    sqlCommand: "check_schema_load",
    sqlQuery: `PRAGMA integrity_check(check_schema_load) ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`,
  },
  checkMissingChildRows: {
    name: "Check Missing Child Rows",
    resultType: "CheckMissingChildRowsResultRow",
    sqlCommand: "check_missing_child_rows",
    sqlQuery: `PRAGMA integrity_check(check_missing_child_rows) ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`,
  },
  checkDivergedPropMaps: {
    name: "Check Diverged Property Maps",
    resultType: "CheckDivergedPropMapsResultRow",
    sqlCommand: "check_diverged_prop_maps",
    sqlQuery: `PRAGMA integrity_check(check_diverged_prop_maps) ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`,
  },
} as const;

/**
 * Type representing the keys of the integrityCheckType map, which correspond to the different types of integrity checks that can be performed.
 */
export type IntegrityCheckKey = keyof typeof integrityCheckTypeMap;

/** Map of integrity check keys to their result row types */
interface IntegrityCheckResultTypeMap {
  checkDataColumns: CheckDataColumnsResultRow;
  checkECProfile: CheckECProfileResultRow;
  checkNavigationClassIds: CheckNavClassIdsResultRow;
  checkNavigationIds: CheckNavIdsResultRow;
  checkLinktableForeignKeyClassIds: CheckLinkTableFkClassIdsResultRow;
  checkLinktableForeignKeyIds: CheckLinkTableFkIdsResultRow;
  checkClassIds: CheckClassIdsResultRow;
  checkDataSchema: CheckDataSchemaResultRow;
  checkSchemaLoad: CheckSchemaLoadResultRow;
  checkMissingChildRows: CheckMissingChildRowsResultRow;
  checkDivergedPropMaps: CheckDivergedPropMapsResultRow;
}

/** Checks the Map to give the return type of a specific integrity check */
type IntegrityCheckResultRow<K extends IntegrityCheckKey> = IntegrityCheckResultTypeMap[K];

/**
 * Return type for quick integrity check
 */
export interface QuickIntegrityCheckResultRow {
  /** Name of the integrity check. */
  check: string;
  /** Whether the check passed. Quick checks do not include problem details. */
  passed: boolean;
  /** Elapsed time for the check, in seconds. */
  elapsedSeconds: string;
}

/**
 * Return type for Check Data Columns integrity check
 */
export interface CheckDataColumnsResultRow {
  /** Sequential result row number. */
  sno: number;
  /** Mapped data table containing a missing column. */
  table: string;
  /** Name of the missing nonvirtual physical column. */
  column: string;
}

/**
 * Return type for Check EC Profile integrity check
 */
export interface CheckECProfileResultRow {
  /** Sequential result row number. */
  sno: number;
  /** Type of EC profile object, such as a table, index, or iModel trigger. */
  type: string;
  /** Name of the EC profile object. */
  name: string;
  /** Description of the missing or mismatching object definition. */
  issue: string;
}

/**
 * Return type for Check Navigation Class Ids integrity check
 */
export interface CheckNavClassIdsResultRow {
  /** Sequential result row number. */
  sno: number;
  /** ID of the source instance row containing the navigation property. */
  id: string;
  /** Declaring or scanned class for the source row; rows from derived classes may be included. */
  class: string;
  /** Name of the navigation property. */
  property: string;
  /** ID of the referenced instance stored by the navigation property. */
  navId: string;
  /** Relationship class ID stored by the navigation property, not the target instance class ID. */
  navClassId: string;
}

/**
 * Return type for Check Navigation Ids integrity check
 */
export interface CheckNavIdsResultRow {
  /** Sequential result row number. */
  sno: number;
  /** ID of the source instance row containing the navigation property. */
  id: string;
  /** Declaring or scanned class for the source row; rows from derived classes may be included. */
  class: string;
  /** Name of the navigation property. */
  property: string;
  /** ID of the referenced instance stored by the navigation property. */
  navId: string;
  /** Class queried for the referenced row: the first relationship constraint class in the navigation direction, including derived classes. */
  primaryClass: string;
}

/**
 * Return type for Check Link Table Foreign Key Class Ids integrity check
 */
export interface CheckLinkTableFkClassIdsResultRow {
  /** Sequential result row number. */
  sno: number;
  /** ID of the relationship row containing the foreign key. */
  id: string;
  /** Link-table relationship class. */
  relationship: string;
  /** Endpoint class-ID property: SourceECClassId or TargetECClassId. */
  property: string;
  /** Source or target endpoint instance ID stored in the link table. */
  keyId: string;
  /** Source or target endpoint class ID; the check verifies that the class exists. */
  keyClassId: string;
}

/**
 * Return type for Check Link Table Foreign Key Ids integrity check
 */
export interface CheckLinkTableFkIdsResultRow {
  /** Sequential result row number. */
  sno: number;
  /** ID of the relationship row containing the foreign key. */
  id: string;
  /** Link-table relationship class. */
  relationship: string;
  /** Endpoint instance-ID property: SourceECInstanceId or TargetECInstanceId. */
  property: string;
  /** Source or target endpoint instance ID stored in the link table. */
  keyId: string;
  /** Class queried for the referenced endpoint row: the first endpoint constraint class, including derived classes. */
  primaryClass: string;
}

/**
 * Return type for Check Class Ids integrity check
 */
export interface CheckClassIdsResultRow {
  /** Sequential result row number. */
  sno: number;
  /** Declaring or scanned class for the row; rows from derived classes may be included. */
  class: string;
  /** ECInstanceId for primary/joined results, or the physical RowId for overflow results. */
  id: string;
  /** Persisted ECClassId value with no matching class definition. */
  classId: string;
  /** Check category: "primary", "joined", or "overflow". */
  type: string;
}

/**
 * Return type for Check Data Schema integrity check
 */
export interface CheckDataSchemaResultRow {
  /** Sequential result row number. */
  sno: number;
  /** Type of missing mapped schema object, such as a table or index. */
  type: string;
  /** Name of the missing mapped schema object. */
  name: string;
}

/**
 * Return type for Check Schema Load integrity check
 */
export interface CheckSchemaLoadResultRow {
  /** Sequential result row number. */
  sno: number;
  /** Name of the schema that the schema manager could not load. */
  schema: string;
}

/**
 * Return type for Check Missing Child Rows integrity check
 */
export interface CheckMissingChildRowsResultRow {
  /** Sequential result row number. */
  sno: number;
  /** Class used to identify the checked rows: "BisCore:Element". */
  class: string;
  /** ID of the existing bis_Element row missing a required child row. */
  id: string;
  /** Persisted ECClassId of the existing element row. */
  classId: string;
  /** Comma-separated names of all child tables checked for the row, not only tables with a missing child row. */
  missingRowInTables: string;
}

/**
 * Return type for Check Diverged Property Maps integrity check
 */
export interface CheckDivergedPropMapsResultRow {
  /** Sequential result row number. */
  sno: number;
  /** ID of the derived class whose inherited property map diverges. */
  derivedClassId: Id64String;
  /** Name of the derived class whose inherited property map diverges. */
  derivedClassName: string;
  /** ID of the base class whose mapping was compared with the derived class. */
  baseClassId: Id64String;
  /** Name of the base class whose mapping was compared with the derived class. */
  baseClassName: string;
  /** Access path of the inherited property with different column mappings. */
  propertyName: string;
  /** Base class mapping, formatted as table.column. */
  baseColumn: string;
  /** Derived class mapping, formatted as table.column. */
  divergedColumn: string;
}

/**
 * Return type for integrity check results, including the check name, whether it passed, and the specific results (if any)
 */
export interface IntegrityCheckResult {
  /** The name of the integrity check that was performed */
  check: string;
  /** Whether the integrity check passed (i.e. no issues were found = true) */
  passed: boolean;
  /** The specific results returned by the integrity check, which may include details about any issues that were found.
   * In the case where issues are found, this will be an array of result rows specific to the type of check that was performed,
   * or an array of quick integrity check results if it was a quick check. */
  results: IntegrityCheckResultRow<IntegrityCheckKey>[] | QuickIntegrityCheckResultRow[];
}

/**
 * Gets the user-friendly name of an integrity check based on its key or SQL command.
 * It first attempts to find a direct match for the key in the integrityCheckTypeMap. If not found, it searches for a match based on the SQL command.
 * If still not found, it returns the original check string.
 * @param check - The integrity check key or SQL command to get the name of
 * @returns The user-friendly name of the integrity check, or the original check string if no match is found
 * @internal
 */
export function getIntegrityCheckName(check: string): string {
  // First try direct lookup by key
  const directLookup = integrityCheckTypeMap[check as IntegrityCheckKey];
  if (directLookup) {
    return directLookup.name;
  }
  // If not found, search by sqlCommand
  for (const [, value] of Object.entries(integrityCheckTypeMap)) {
    if (value.sqlCommand === check) {
      return value.name;
    }
  }
  // Fallback to the original check string
  return check;
}

/**
 * Performs a quick integrity check on the given iModel.
 * @param iModel The IModelDb instance to perform the integrity check on
 * @returns An array of results for each check performed, including the check name, whether it passed, and the elapsed time in seconds
 * @internal
 */
export async function performQuickIntegrityCheck(iModel: IModelDb): Promise<QuickIntegrityCheckResultRow[]> {
  const integrityCheckQuery = "PRAGMA integrity_check ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES";
  const integrityCheckResults: QuickIntegrityCheckResultRow[] = [];
  for await (const row of iModel.createQueryReader(integrityCheckQuery, undefined, { usePrimaryConn: true })) {
    integrityCheckResults.push({ check: getIntegrityCheckName(row.check), passed: row.result, elapsedSeconds: row.elapsed_sec });
  };
  return integrityCheckResults;
}

/**
 * Performs a specific integrity check on the given iModel based on the provided check key, and returns the results specific to that check type.
 * @param iModel The IModelDb instance to perform the integrity check on
 * @param check The key of the specific integrity check to perform
 * @return An array of results specific to the integrity check that was performed. The type of the result rows will depend on the check that was executed.
 * @throws IModelError with status BadRequest if an unknown integrity check key is provided
 * @internal
 */
export async function performSpecificIntegrityCheck(iModel: IModelDb, check: "checkDataColumns"): Promise<IntegrityCheckResultRow<"checkDataColumns">[]>;
export async function performSpecificIntegrityCheck(iModel: IModelDb, check: "checkECProfile"): Promise<IntegrityCheckResultRow<"checkECProfile">[]>;
export async function performSpecificIntegrityCheck(iModel: IModelDb, check: "checkNavigationClassIds"): Promise<IntegrityCheckResultRow<"checkNavigationClassIds">[]>;
export async function performSpecificIntegrityCheck(iModel: IModelDb, check: "checkNavigationIds"): Promise<IntegrityCheckResultRow<"checkNavigationIds">[]>;
export async function performSpecificIntegrityCheck(iModel: IModelDb, check: "checkLinktableForeignKeyClassIds"): Promise<IntegrityCheckResultRow<"checkLinktableForeignKeyClassIds">[]>;
export async function performSpecificIntegrityCheck(iModel: IModelDb, check: "checkLinktableForeignKeyIds"): Promise<IntegrityCheckResultRow<"checkLinktableForeignKeyIds">[]>;
export async function performSpecificIntegrityCheck(iModel: IModelDb, check: "checkClassIds"): Promise<IntegrityCheckResultRow<"checkClassIds">[]>;
export async function performSpecificIntegrityCheck(iModel: IModelDb, check: "checkDataSchema"): Promise<IntegrityCheckResultRow<"checkDataSchema">[]>;
export async function performSpecificIntegrityCheck(iModel: IModelDb, check: "checkSchemaLoad"): Promise<IntegrityCheckResultRow<"checkSchemaLoad">[]>;
export async function performSpecificIntegrityCheck(iModel: IModelDb, check: "checkMissingChildRows"): Promise<IntegrityCheckResultRow<"checkMissingChildRows">[]>;
export async function performSpecificIntegrityCheck(iModel: IModelDb, check: "checkDivergedPropMaps"): Promise<IntegrityCheckResultRow<"checkDivergedPropMaps">[]>;
export async function performSpecificIntegrityCheck<K extends IntegrityCheckKey>(iModel: IModelDb, check: K): Promise<IntegrityCheckResultRow<K>[]>;
export async function performSpecificIntegrityCheck(iModel: IModelDb, check: IntegrityCheckKey): Promise<IntegrityCheckResultRow<IntegrityCheckKey>[]> {
  switch (check) {
    case "checkDataColumns": {
      const results: CheckDataColumnsResultRow[] = [];
      for await (const row of iModel.createQueryReader(integrityCheckTypeMap.checkDataColumns.sqlQuery, undefined, { usePrimaryConn: true })) {
        results.push({ sno: row.sno, table: row.table, column: row.column });
      }
      return results;
    }
    case "checkECProfile": {
      const results: CheckECProfileResultRow[] = [];
      for await (const row of iModel.createQueryReader(integrityCheckTypeMap.checkECProfile.sqlQuery, undefined, { usePrimaryConn: true })) {
        results.push({ sno: row.sno, type: row.type, name: row.name, issue: row.issue });
      }
      return results;
    }
    case "checkNavigationClassIds": {
      const results: CheckNavClassIdsResultRow[] = [];
      for await (const row of iModel.createQueryReader(integrityCheckTypeMap.checkNavigationClassIds.sqlQuery, undefined, { usePrimaryConn: true })) {
        results.push({ sno: row.sno, id: row.id, class: row.class, property: row.property, navId: row.nav_id, navClassId: row.nav_classId });
      }
      return results;
    }
    case "checkNavigationIds": {
      const results: CheckNavIdsResultRow[] = [];
      for await (const row of iModel.createQueryReader(integrityCheckTypeMap.checkNavigationIds.sqlQuery, undefined, { usePrimaryConn: true })) {
        results.push({ sno: row.sno, id: row.id, class: row.class, property: row.property, navId: row.nav_id, primaryClass: row.primary_class });
      }
      return results;
    }
    case "checkLinktableForeignKeyClassIds": {
      const results: CheckLinkTableFkClassIdsResultRow[] = [];
      for await (const row of iModel.createQueryReader(integrityCheckTypeMap.checkLinktableForeignKeyClassIds.sqlQuery, undefined, { usePrimaryConn: true })) {
        results.push({ sno: row.sno, id: row.id, relationship: row.relationship, property: row.property, keyId: row.key_id, keyClassId: row.key_classId });
      }
      return results;
    }
    case "checkLinktableForeignKeyIds": {
      const results: CheckLinkTableFkIdsResultRow[] = [];
      for await (const row of iModel.createQueryReader(integrityCheckTypeMap.checkLinktableForeignKeyIds.sqlQuery, undefined, { usePrimaryConn: true })) {
        results.push({ sno: row.sno, id: row.id, relationship: row.relationship, property: row.property, keyId: row.key_id, primaryClass: row.primary_class });
      }
      return results;
    }
    case "checkClassIds": {
      const results: CheckClassIdsResultRow[] = [];
      for await (const row of iModel.createQueryReader(integrityCheckTypeMap.checkClassIds.sqlQuery, undefined, { usePrimaryConn: true })) {
        results.push({ sno: row.sno, class: row.class, id: row.id, classId: row.class_id, type: row.type });
      }
      return results;
    }
    case "checkDataSchema": {
      const results: CheckDataSchemaResultRow[] = [];
      for await (const row of iModel.createQueryReader(integrityCheckTypeMap.checkDataSchema.sqlQuery, undefined, { usePrimaryConn: true })) {
        results.push({ sno: row.sno, type: row.type, name: row.name });
      }
      return results;
    }
    case "checkSchemaLoad": {
      const results: CheckSchemaLoadResultRow[] = [];
      for await (const row of iModel.createQueryReader(integrityCheckTypeMap.checkSchemaLoad.sqlQuery, undefined, { usePrimaryConn: true })) {
        results.push({ sno: row.sno, schema: row.schema });
      }
      return results;
    }
    case "checkMissingChildRows": {
      const results: CheckMissingChildRowsResultRow[] = [];
      for await (const row of iModel.createQueryReader(integrityCheckTypeMap.checkMissingChildRows.sqlQuery, undefined, { usePrimaryConn: true })) {
        results.push({ sno: row.sno, class: row.class, id: row.id, classId: row.class_id, missingRowInTables: row.MissingRowInTables });
      }
      return results;
    }
    case "checkDivergedPropMaps": {
      const results: CheckDivergedPropMapsResultRow[] = [];
      for await (const row of iModel.createQueryReader(integrityCheckTypeMap.checkDivergedPropMaps.sqlQuery, undefined, { usePrimaryConn: true })) {
        results.push({ sno: row.sno, derivedClassId: row.derivedClassId, derivedClassName: row.derivedClassName, baseClassId: row.baseClassId, baseClassName: row.baseClassName, propertyName: row.propertyName, baseColumn: row.baseColumn, divergedColumn: row.divergedColumn });
      }
      return results;
    }
    default:
      throw new IModelError(IModelStatus.BadRequest, `Unknown integrity check type`);
  }
}