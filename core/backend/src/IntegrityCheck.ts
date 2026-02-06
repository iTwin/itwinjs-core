import { IModelStatus } from "@itwin/core-bentley";
import { IModelError } from "@itwin/core-common/lib/cjs/IModelError";
import { IModelDb } from "./IModelDb";

export interface QuickIntegrityCheckResultRow {
  check: string;
  passed: boolean;
  elapsedSeconds: string;
}

export interface CheckDataColumnsResultRow {
  sno: number;
  table: string;
  column: string;
}

export interface CheckECProfileResultRow {
  sno: number;
  type: string;
  name: string;
  issue: string;
}

export interface CheckNavClassIdsResultRow {
  sno: number;
  id: string;
  class: string;
  property: string;
  navId: string;
  navClassId: string;
}

export interface CheckNavIdsResultRow {
  sno: number;
  id: string;
  class: string;
  property: string;
  navId: string;
  primaryClass: string;
}

export interface CheckLinkTableFkClassIdsResultRow {
  sno: number;
  id: string;
  relationship: string;
  property: string;
  keyId: string;
  keyClassId: string;
}

export interface CheckLinkTableFkIdsResultRow {
  sno: number;
  id: string;
  relationship: string;
  property: string;
  keyId: string;
  primaryClass: string;
}

export interface CheckClassIdsResultRow {
  sno: number;
  class: string;
  id: string;
  classId: string;
  type: string;
}

export interface CheckDataSchemaResultRow {
  sno: number;
  type: string;
  name: string;
}

export interface CheckSchemaLoadResultRow {
  sno: number;
  schema: string;
}

export interface CheckMissingChildRowsResultRow {
  sno: number;
  class: string;
  id: string;
  classId: string;
  missingRowInTables: string;
}

/** Integrity check types with their display names
 * @internal
 */
export const integrityCheckType = {
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

export interface IntegrityCheckResult {
  check: string;
  passed: boolean;
  results: IntegrityCheckResultRow<IntegrityCheckKey>[] | QuickIntegrityCheckResultRow[];
}

export type IntegrityCheckKey = keyof typeof integrityCheckType;

// Map of integrity check keys to their result row types
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

// Result row type for a specific check
type IntegrityCheckResultRow<K extends IntegrityCheckKey> = IntegrityCheckResultTypeMap[K];

export function getIntegrityCheckName(check: string): string {
  // First try direct lookup by key
  const directLookup = integrityCheckType[check as IntegrityCheckKey];
  if (directLookup) {
    return directLookup.name;
  }
  // If not found, search by sqlCommand
  for (const [, value] of Object.entries(integrityCheckType)) {
    if (value.sqlCommand === check) {
      return value.name;
    }
  }
  // Fallback to the original check string
  return check;
}

export async function performQuickIntegrityCheck(iModel: IModelDb): Promise<QuickIntegrityCheckResultRow[]> {
  const integrityCheckQuery = "PRAGMA integrity_check options enable_experimental_features";
  const integrityCheckResults: QuickIntegrityCheckResultRow[] = [];
  for await (const row of iModel.createQueryReader(integrityCheckQuery)) {
    integrityCheckResults.push({ check: getIntegrityCheckName(row.check), passed: row.result, elapsedSeconds: row.elapsed_sec});
  };
  return integrityCheckResults;
}

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
      for await (const row of iModel.createQueryReader(integrityCheckType.checkDataColumns.sqlQuery)) {
        results.push({ sno: row.sno, table: row.table, column: row.column });
      }
      return results;
    }
    case "checkECProfile": {
      const results: CheckECProfileResultRow[] = [];
      const integrityCheckQuery = `PRAGMA integrity_check(check_ec_profile) options enable_experimental_features`;
      for await (const row of iModel.createQueryReader(integrityCheckQuery)) {
        results.push({ sno: row.sno, type: row.type, name: row.name, issue: row.issue });
      }
      return results;
    }
    case "checkNavigationClassIds": {
      const results: CheckNavClassIdsResultRow[] = [];
      const integrityCheckQuery = `PRAGMA integrity_check(check_nav_class_ids) options enable_experimental_features`;
      for await (const row of iModel.createQueryReader(integrityCheckQuery)) {
        results.push({ sno: row.sno, id: row.id, class: row.class, property: row.property, navId: row.nav_id, navClassId: row.nav_classId });
      }
      return results;
    }
    case "checkNavigationIds": {
      const results: CheckNavIdsResultRow[] = [];
      const integrityCheckQuery = `PRAGMA integrity_check(check_nav_ids) options enable_experimental_features`;
      for await (const row of iModel.createQueryReader(integrityCheckQuery)) {
        results.push({ sno: row.sno, id: row.id, class: row.class, property: row.property, navId: row.nav_id, primaryClass: row.primary_class });
      }
      return results;
    }
    case "checkLinktableForeignKeyClassIds": {
      const results: CheckLinkTableFkClassIdsResultRow[] = [];
      const integrityCheckQuery = `PRAGMA integrity_check(check_linktable_fk_class_ids) options enable_experimental_features`;
      for await (const row of iModel.createQueryReader(integrityCheckQuery)) {
        results.push({ sno: row.sno, id: row.id, relationship: row.relationship, property: row.property, keyId: row.key_id, keyClassId: row.key_classId });
      }
      return results;
    }
    case "checkLinktableForeignKeyIds": {
      const results: CheckLinkTableFkIdsResultRow[] = [];
      const integrityCheckQuery = `PRAGMA integrity_check(check_linktable_fk_ids) options enable_experimental_features`;
      for await (const row of iModel.createQueryReader(integrityCheckQuery)) {
        results.push({ sno: row.sno, id: row.id, relationship: row.relationship, property: row.property, keyId: row.key_id, primaryClass: row.primary_class });
      }
      return results;
    }
    case "checkClassIds": {
      const results: CheckClassIdsResultRow[] = [];
      const integrityCheckQuery = `PRAGMA integrity_check(check_class_ids) options enable_experimental_features`;
      for await (const row of iModel.createQueryReader(integrityCheckQuery)) {
        results.push({ sno: row.sno, class: row.class, id: row.id, classId: row.class_id, type: row.type });
      }
      return results;
    }
    case "checkDataSchema": {
      const results: CheckDataSchemaResultRow[] = [];
      const integrityCheckQuery = `PRAGMA integrity_check(check_data_schema) options enable_experimental_features`;
      for await (const row of iModel.createQueryReader(integrityCheckQuery)) {
        results.push({ sno: row.sno, type: row.type, name: row.name });
      }
      return results;
    }
    case "checkSchemaLoad": {
      const results: CheckSchemaLoadResultRow[] = [];
      const integrityCheckQuery = `PRAGMA integrity_check(check_schema_load) options enable_experimental_features`;
      for await (const row of iModel.createQueryReader(integrityCheckQuery)) {
        results.push({ sno: row.sno, schema: row.schema });
      }
      return results;
    }
    case "checkMissingChildRows": {
      const results: CheckMissingChildRowsResultRow[] = [];
      const integrityCheckQuery = `PRAGMA integrity_check(check_missing_child_rows) options enable_experimental_features`;
      for await (const row of iModel.createQueryReader(integrityCheckQuery)) {
        results.push({ sno: row.sno, class: row.class, id: row.id, classId: row.class_id, missingRowInTables: row.MissingRowInTables });
      }
      return results;
    }
    default:
      throw new IModelError(IModelStatus.BadRequest, `Unknown integrity check type: ${check}`);
  }
}