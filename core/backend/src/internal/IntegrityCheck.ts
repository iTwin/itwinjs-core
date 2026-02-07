/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelStatus } from "@itwin/core-bentley";
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
    sqlQuery: `PRAGMA integrity_check(check_data_columns) options enable_experimental_features`,
  },
  checkECProfile: {
    name: "Check EC Profile",
    resultType: "CheckECProfileResultRow",
    sqlCommand: "check_ec_profile",
    sqlQuery: `PRAGMA integrity_check(check_ec_profile) options enable_experimental_features`,
  },
  checkNavigationClassIds: {
    name: "Check Navigation Class Ids",
    resultType: "CheckNavClassIdsResultRow",
    sqlCommand: "check_nav_class_ids",
    sqlQuery: `PRAGMA integrity_check(check_nav_class_ids) options enable_experimental_features`,
  },
  checkNavigationIds: {
    name: "Check Navigation Ids",
    resultType: "CheckNavIdsResultRow",
    sqlCommand: "check_nav_ids",
    sqlQuery: `PRAGMA integrity_check(check_nav_ids) options enable_experimental_features`,
  },
  checkLinktableForeignKeyClassIds: {
    name: "Check Link Table Foreign Key Class Ids",
    resultType: "CheckLinkTableFkClassIdsResultRow",
    sqlCommand: "check_linktable_fk_class_ids",
    sqlQuery: `PRAGMA integrity_check(check_linktable_fk_class_ids) options enable_experimental_features`,
  },
  checkLinktableForeignKeyIds: {
    name: "Check Link Table Foreign Key Ids",
    resultType: "CheckLinkTableFkIdsResultRow",
    sqlCommand: "check_linktable_fk_ids",
    sqlQuery: `PRAGMA integrity_check(check_linktable_fk_ids) options enable_experimental_features`,
  },
  checkClassIds: {
    name: "Check Class Ids",
    resultType: "CheckClassIdsResultRow",
    sqlCommand: "check_class_ids",
    sqlQuery: `PRAGMA integrity_check(check_class_ids) options enable_experimental_features`,
  },
  checkDataSchema: {
    name: "Check Data Schema",
    resultType: "CheckDataSchemaResultRow",
    sqlCommand: "check_data_schema",
    sqlQuery: `PRAGMA integrity_check(check_data_schema) options enable_experimental_features`,
  },
  checkSchemaLoad: {
    name: "Check Schema Load",
    resultType: "CheckSchemaLoadResultRow",
    sqlCommand: "check_schema_load",
    sqlQuery: `PRAGMA integrity_check(check_schema_load) options enable_experimental_features`,
  },
  checkMissingChildRows: {
    name: "Check Missing Child Rows",
    resultType: "CheckMissingChildRowsResultRow",
    sqlCommand: "check_missing_child_rows",
    sqlQuery: `PRAGMA integrity_check(check_missing_child_rows) options enable_experimental_features`,
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
}

/** Checks the Map to give the return type of a specific integrity check */
type IntegrityCheckResultRow<K extends IntegrityCheckKey> = IntegrityCheckResultTypeMap[K];

/**
 * Return type for quick integrity check
 */
export interface QuickIntegrityCheckResultRow {
  check: string;
  passed: boolean;
  elapsedSeconds: string;
}

/**
 * Return type for Check Data Columns integrity check
 */
export interface CheckDataColumnsResultRow {
  sno: number;
  table: string;
  column: string;
}

/**
 * Return type for Check EC Profile integrity check
 */
export interface CheckECProfileResultRow {
  sno: number;
  type: string;
  name: string;
  issue: string;
}

/**
 * Return type for Check Navigation Class Ids integrity check
 */
export interface CheckNavClassIdsResultRow {
  sno: number;
  id: string;
  class: string;
  property: string;
  navId: string;
  navClassId: string;
}

/**
 * Return type for Check Navigation Ids integrity check
 */
export interface CheckNavIdsResultRow {
  sno: number;
  id: string;
  class: string;
  property: string;
  navId: string;
  primaryClass: string;
}

/**
 * Return type for Check Link Table Foreign Key Class Ids integrity check
 */
export interface CheckLinkTableFkClassIdsResultRow {
  sno: number;
  id: string;
  relationship: string;
  property: string;
  keyId: string;
  keyClassId: string;
}

/**
 * Return type for Check Link Table Foreign Key Ids integrity check
 */
export interface CheckLinkTableFkIdsResultRow {
  sno: number;
  id: string;
  relationship: string;
  property: string;
  keyId: string;
  primaryClass: string;
}

/**
 * Return type for Check Class Ids integrity check
 */
export interface CheckClassIdsResultRow {
  sno: number;
  class: string;
  id: string;
  classId: string;
  type: string;
}

/**
 * Return type for Check Data Schema integrity check
 */
export interface CheckDataSchemaResultRow {
  sno: number;
  type: string;
  name: string;
}

/**
 * Return type for Check Schema Load integrity check
 */
export interface CheckSchemaLoadResultRow {
  sno: number;
  schema: string;
}

/**
 * Return type for Check Missing Child Rows integrity check
 */
export interface CheckMissingChildRowsResultRow {
  sno: number;
  class: string;
  id: string;
  classId: string;
  missingRowInTables: string;
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
  const integrityCheckQuery = "PRAGMA integrity_check options enable_experimental_features";
  const integrityCheckResults: QuickIntegrityCheckResultRow[] = [];
  for await (const row of iModel.createQueryReader(integrityCheckQuery)) {
    integrityCheckResults.push({ check: getIntegrityCheckName(row.check), passed: row.result, elapsedSeconds: row.elapsed_sec});
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
export async function performSpecificIntegrityCheck<K extends IntegrityCheckKey>(iModel: IModelDb, check: K): Promise<IntegrityCheckResultRow<K>[]>;
export async function performSpecificIntegrityCheck(iModel: IModelDb, check: IntegrityCheckKey): Promise<IntegrityCheckResultRow<IntegrityCheckKey>[]> {
  switch (check) {
    case "checkDataColumns": {
      const results: CheckDataColumnsResultRow[] = [];
      for await (const row of iModel.createQueryReader(integrityCheckTypeMap.checkDataColumns.sqlQuery)) {
        results.push({ sno: row.sno, table: row.table, column: row.column });
      }
      return results;
    }
    case "checkECProfile": {
      const results: CheckECProfileResultRow[] = [];
      for await (const row of iModel.createQueryReader(integrityCheckTypeMap.checkECProfile.sqlQuery)) {
        results.push({ sno: row.sno, type: row.type, name: row.name, issue: row.issue });
      }
      return results;
    }
    case "checkNavigationClassIds": {
      const results: CheckNavClassIdsResultRow[] = [];
      for await (const row of iModel.createQueryReader(integrityCheckTypeMap.checkNavigationClassIds.sqlQuery)) {
        results.push({ sno: row.sno, id: row.id, class: row.class, property: row.property, navId: row.nav_id, navClassId: row.nav_classId });
      }
      return results;
    }
    case "checkNavigationIds": {
      const results: CheckNavIdsResultRow[] = [];
      for await (const row of iModel.createQueryReader(integrityCheckTypeMap.checkNavigationIds.sqlQuery)) {
        results.push({ sno: row.sno, id: row.id, class: row.class, property: row.property, navId: row.nav_id, primaryClass: row.primary_class });
      }
      return results;
    }
    case "checkLinktableForeignKeyClassIds": {
      const results: CheckLinkTableFkClassIdsResultRow[] = [];
      for await (const row of iModel.createQueryReader(integrityCheckTypeMap.checkLinktableForeignKeyClassIds.sqlQuery)) {
        results.push({ sno: row.sno, id: row.id, relationship: row.relationship, property: row.property, keyId: row.key_id, keyClassId: row.key_classId });
      }
      return results;
    }
    case "checkLinktableForeignKeyIds": {
      const results: CheckLinkTableFkIdsResultRow[] = [];
      for await (const row of iModel.createQueryReader(integrityCheckTypeMap.checkLinktableForeignKeyIds.sqlQuery)) {
        results.push({ sno: row.sno, id: row.id, relationship: row.relationship, property: row.property, keyId: row.key_id, primaryClass: row.primary_class });
      }
      return results;
    }
    case "checkClassIds": {
      const results: CheckClassIdsResultRow[] = [];
      for await (const row of iModel.createQueryReader(integrityCheckTypeMap.checkClassIds.sqlQuery)) {
        results.push({ sno: row.sno, class: row.class, id: row.id, classId: row.class_id, type: row.type });
      }
      return results;
    }
    case "checkDataSchema": {
      const results: CheckDataSchemaResultRow[] = [];
      for await (const row of iModel.createQueryReader(integrityCheckTypeMap.checkDataSchema.sqlQuery)) {
        results.push({ sno: row.sno, type: row.type, name: row.name });
      }
      return results;
    }
    case "checkSchemaLoad": {
      const results: CheckSchemaLoadResultRow[] = [];
      for await (const row of iModel.createQueryReader(integrityCheckTypeMap.checkSchemaLoad.sqlQuery)) {
        results.push({ sno: row.sno, schema: row.schema });
      }
      return results;
    }
    case "checkMissingChildRows": {
      const results: CheckMissingChildRowsResultRow[] = [];
      for await (const row of iModel.createQueryReader(integrityCheckTypeMap.checkMissingChildRows.sqlQuery)) {
        results.push({ sno: row.sno, class: row.class, id: row.id, classId: row.class_id, missingRowInTables: row.MissingRowInTables });
      }
      return results;
    }
    default:
      throw new IModelError(IModelStatus.BadRequest, `Unknown integrity check type: ${check}`);
  }
}