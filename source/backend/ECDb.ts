import { DbResult, OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { ECJsonTypeMap, ECInstance } from "@bentley/bentleyjs-core/lib/ECJsonTypeMap";
import { BentleyPromise } from "@bentley/bentleyjs-core/lib/Bentley";
import { BindingUtility, BindingValue } from "./BindingUtility";
import { PrimitiveTypeCode } from "../Entity";

declare function require(arg: string): any;
// tslint:disable-next-line:no-var-requires
const addonLoader = require("../../scripts/addonLoader");
let dgnDbNodeAddon: any | undefined;
if (addonLoader !== undefined)
  dgnDbNodeAddon = addonLoader.loadNodeAddon(); // Note that evaluating this script has the side-effect of loading the addon

/** Value type  (Match this to ECN::ValueKind in ECObjects.h) */
export const enum ValueKind {
  /** The ECValue has not be initialized yet */
  Uninitialized = 0x00,
  /** The ECValue holds a Primitive type */
  Primitive = 0x01,
  /** The ECValue holds a struct */
  Struct = 0x02,
  /** The ECValue holds an array */
  Array = 0x04,
  /** The ECValue holds a navigation type */
  Navigation = 0x08,
}

/** ECValue invariant */
export class ECValue {
  public kind: ValueKind;
  public type: PrimitiveTypeCode;
  public value: null | PrimitiveType | StructType | ArrayType;
}

/** Value types */
export interface Point2dType { x: number; y: number; }
export interface Point3dType { x: number; y: number; z: number; }
export type PrimitiveType = string | number | boolean | Point2dType | Point3dType;
export interface StructType {
  [index: string]: ECValue;
}
export type ArrayType = ECValue[];

/** Types that can be used for binding paramter values */
export type BindingValue = null | PrimitiveType | ECValue;

/** Custom type guard for Point2dType  */
export function isPoint2dType(arg: any): arg is Point2dType {
  return arg.x !== undefined && arg.y !== undefined && arg.z === undefined;
}

/** Custom type guard for Point3dType  */
export function isPoint3dType(arg: any): arg is Point3dType {
  return arg.x !== undefined && arg.y !== undefined && arg.z !== undefined;
}

/** Allows performing CRUD operations in an ECDb */
export class ECDb {
  private ecdb: any;

  /**
   * Create an ECDb
   * @param pathname  The pathname of the Db.
   * @returns Promise that resolves to an object that contains an error property if the operation failed.
   */
  public async createDb(pathname: string): BentleyPromise<DbResult, void> {
    if (!this.ecdb)
      this.ecdb = await new dgnDbNodeAddon.ECDb();
    return await this.ecdb.createDb(pathname);
  }

  /**
   * Open the ECDb.
   * @param pathname The pathname of the Db
   * @param mode  Open mode
   * @returns Promise that resolves to an object that contains an error property if the operation failed.
   */
  public async openDb(pathname: string, mode: OpenMode = OpenMode.Readonly): BentleyPromise<DbResult, void> {
    if (!this.ecdb)
      this.ecdb = await new dgnDbNodeAddon.ECDb();
    return await this.ecdb.openDb(pathname, mode);
  }

  /** Returns true if the ECDb is open */
  public isDbOpen(): boolean {
    return this.ecdb && this.ecdb.IsDbOpen;
  }

  /**
   * Close the Db after saving any uncommitted changes.
   * @returns Promise that resolves to an object that contains an error property if the operation failed.
   * If the Db is not already open it's considered as an error.
   */
  public async closeDb(): BentleyPromise<DbResult, void> {
    if (!this.ecdb)
      return { error: { status: DbResult.BE_SQLITE_ERROR, message: "ECDb must be created or opened to complete this operation" } };

    return await this.ecdb.closeDb();
  }

  /**
   * Commit the outermost transaction, writing changes to the file. Then, restart the transaction.
   * @param changeSetName The name of the operation that generated these changes.
   * @returns Promise that resolves to an object that contains an error property if the operation failed.
   */
  public async saveChanges(changeSetName?: string): BentleyPromise<DbResult, void> {
    if (!this.ecdb)
      return { error: { status: DbResult.BE_SQLITE_ERROR, message: "ECDb must be created or opened to complete this operation" } };

    return this.ecdb.saveChanges(changeSetName);
  }

  /**
   * Abandon (cancel) the outermost transaction, discarding all changes since last save. Then, restart the transaction.
   * @returns Promise that resolves to an object that contains an error property if the operation failed.
   */
  public async abandonChanges(): BentleyPromise<DbResult, void> {
    if (!this.ecdb)
      return { error: { status: DbResult.BE_SQLITE_ERROR, message: "ECDb must be created or opened to complete this operation" } };

    return this.ecdb.abandonChanges();
  }

  /**
   * Import a schema
   * Note that if the import was successful, the database is automatically saved to disk.
   * @returns Promise that resolves to an object that contains an error if the operation failed.
   * Check the existence of the error property to determine if the operation was successful.
   */
  public async importSchema(pathname: string): BentleyPromise<DbResult, void> {
    if (!this.ecdb)
      return { error: { status: DbResult.BE_SQLITE_ERROR, message: "ECDb must be created or opened to complete this operation" } };

    return this.ecdb.importSchema(pathname);
  }

  /**
   * Insert an instance
   * @description This method is not meant for bulk inserts
   * @returns Promise that resolves to an object with a result property set to the id of the inserted instance.
   * The resolved object contains an error property if the operation failed.
   */
  public async insertInstance<T extends ECInstance>(typedInstance: T): BentleyPromise<DbResult, void> {
    if (!this.ecdb)
      return { error: { status: DbResult.BE_SQLITE_ERROR, message: "ECDb must be created or opened to complete this operation" } };

    const jsonInstance: any = ECJsonTypeMap.toJson<T>("ecdb", typedInstance);
    if (!jsonInstance)
      return { error: { status: DbResult.BE_SQLITE_ERROR, message: "Error writing instance as JSON" } };

    const { error, result: id } = await this.ecdb.insertInstance(JSON.stringify(jsonInstance));
    if (error)
      return { error };

    typedInstance.id = id;
    return {};
  }

  /**
   * Read an instance
   * @description This method is not meant for bulk reads.
   * @returns Promise that resolves to an object with a result property set to the instance that was read from the Db.
   * The resolved object contains an error property if the operation failed.
   */
  public async readInstance<T extends ECInstance>(typedInstanceKey: T): BentleyPromise<DbResult, T> {
    if (!this.ecdb)
      return { error: { status: DbResult.BE_SQLITE_ERROR, message: "ECDb must be created or opened to complete this operation" } };

    const jsonInstanceKey: any = ECJsonTypeMap.toJson<T>("ecdb", typedInstanceKey);
    if (!jsonInstanceKey)
      throw Error("Invalid key. Check that the typescript class is mapped to JSON properly");

    const { error, result: untypedInstanceStr } = await this.ecdb.readInstance(JSON.stringify(jsonInstanceKey));
    if (error)
      return { error };

    const untypedInstance = JSON.parse(untypedInstanceStr);

    const typedConstructor = Object.getPrototypeOf(typedInstanceKey).constructor;
    const typedInstance: T | undefined = ECJsonTypeMap.fromJson<T>(typedConstructor, "ecdb", untypedInstance);
    if (!typedInstance)
      return { error: { status: DbResult.BE_SQLITE_ERROR, message: "Error reading instance" } };

    return { result: typedInstance };
  }

  /**
   * Update an instance
   * @description This method is not meant for bulk updates
   * @returns Promise that resolves to an object that contains an error property if the operation failed.
   */
  public async updateInstance<T extends ECInstance>(typedInstance: T): BentleyPromise<DbResult, void> {
    if (!this.ecdb)
      return { error: { status: DbResult.BE_SQLITE_ERROR, message: "ECDb must be created or opened to complete this operation" } };

    const untypedInstance: any = ECJsonTypeMap.toJson<T>("ecdb", typedInstance);
    return await this.ecdb.updateInstance(JSON.stringify(untypedInstance));
  }

  /**
   * Delete an instance
   * @description This method is not meant for bulk deletes
   * @returns Promise that resolves to an object that contains an error property if the operation failed.
   */
  public async deleteInstance<T extends ECInstance>(typedInstanceKey: T): BentleyPromise<DbResult, void> {
    if (!this.ecdb)
      return { error: { status: DbResult.BE_SQLITE_ERROR, message: "ECDb must be created or opened to complete this operation" } };

    const jsonInstanceKey: any = ECJsonTypeMap.toJson<T>("ecdb", typedInstanceKey);
    return await this.ecdb.deleteInstance(JSON.stringify(jsonInstanceKey));
  }

  /**
   * Check if an instance exists
   * @returns Promise that resolves to an object with a result property set to true or false depending on whether the Db contains the instance with the specified key.
   * The resolved object contains an error property if the operation failed.
   */
  public async containsInstance<T extends ECInstance>(typedInstanceKey: T): BentleyPromise<DbResult, boolean> {
    if (!this.ecdb)
      return { error: { status: DbResult.BE_SQLITE_ERROR, message: "ECDb must be created or opened to complete this operation" } };

    const jsonInstanceKey: any = ECJsonTypeMap.toJson<T>("ecdb", typedInstanceKey);
    return this.ecdb.containsInstance(JSON.stringify(jsonInstanceKey));
  }

  /**
   * Execute an ECSql query returning all rows as an array of objects in JSON syntax.
   * @returns all rows in JSON syntax or the empty string if nothing was selected
   * @todo Extend bindings to other types.
   * @todo Simplify binding of values to ECSQL statements.
   * The bindings parameter includes meta-data information in some cases now, but the typical consumer
   * shouldn't be bothered to pass this information. The information may be available when the ECSQL is
   * parsed, even if it's not exposed through the IECSqlBinder interface. Needs some implementation.
   * @todo Consider writing Guid-s as Blobs. Guids are serialized as strings now, but they may need to
   * be written as blobs for performance (see the ECSqlStatement API). Note that even if we did want
   * to do this, the Guid type information is not part of the EC meta data.
   * @returns Promise that resolves to an object with a result property set to a JSON array containing the rows returned from the query
   * The resolved object contains an error property if the operation failed.
   */
  public async executeQuery(ecsql: string, bindings?: BindingValue[] | Map<string, BindingValue> | any): BentleyPromise<DbResult, any[]> {
    if (!this.ecdb)
      return { error: { status: DbResult.BE_SQLITE_ERROR, message: "ECDb must be created or opened to complete this operation" } };

    let ecBindingsStr: string | undefined;
    if (bindings) {
      const { error, result: ecBindings } = BindingUtility.preProcessBindings(bindings);
      if (error)
        return { error };
      ecBindingsStr = JSON.stringify(ecBindings);
    }

    const {reserror, result: rowsJson} = await this.ecdb.executeQuery(ecsql, ecBindingsStr);
    if (reserror !== undefined) {
      return {error: reserror};
    }
    if (rowsJson === undefined) {
      return {error: {status: DbResult.BE_SQLITE_ERROR, message: ""}};
    }
    return {result: JSON.parse(rowsJson)};
  }

  /**
   * Execute an ECSql statement
   * @param ecsql ECSql string
   * @param bindings Optional bindings required to execute the statement.
   * @returns Promise that resolves to an object that contains an error property if the operation failed.
   * If the operation was successful and it was an insert, the returned object will contain a result property set to the id of the inserted instance.
   */
  public async executeStatement(ecsql: string, isInsertStatement?: boolean, bindings?: BindingValue[] | Map<string, BindingValue> | any): BentleyPromise<DbResult, string> {
    if (!this.ecdb)
      return { error: { status: DbResult.BE_SQLITE_ERROR, message: "ECDb must be created or opened to complete this operation" } };

    let ecBindingsStr: string | undefined;
    if (bindings) {
      const { error, result: ecBindings } = BindingUtility.preProcessBindings(bindings);
      if (error)
        return { error };
      ecBindingsStr = JSON.stringify(ecBindings);
    }

    return this.ecdb.executeStatement(ecsql, isInsertStatement, ecBindingsStr);
  }
}
