import { DbResult, OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { ECJsonTypeMap, ECInstance } from "@bentley/bentleyjs-core/lib/ECJsonTypeMap";
import { PrimitiveTypeCode } from "../Entity";
import { IModelError } from "../IModelError";
import { BindingUtility, BindingValue } from "./BindingUtility";

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
  private _ecdb: any;

  /** Construct an invalid ECDb Error. */
  private _newInvalidDatabaseError(): IModelError {
    return new IModelError(DbResult.BE_SQLITE_ERROR, "ECDb must be created or opened to complete this operation");
  }

  /** Create an ECDb
   * @param pathname  The pathname of the Db.
   * @throws [[IModelError]] if the operation failed.
   */
  public async createDb(pathname: string): Promise<void> {
    if (!this._ecdb)
      this._ecdb = await new dgnDbNodeAddon.ECDb();
    const { error } = await this._ecdb.createDb(pathname);
    if (error)
      return Promise.reject(new IModelError(error.status, error.message));
  }

  /** Open the ECDb.
   * @param pathname The pathname of the Db
   * @param openMode  Open mode
   * @throws [[IModelError]] if the operation failed.
   */
  public async openDb(pathname: string, openMode: OpenMode = OpenMode.Readonly): Promise<void> {
    if (!this._ecdb)
      this._ecdb = await new dgnDbNodeAddon.ECDb();
    const { error } = await this._ecdb.openDb(pathname, openMode);
    if (error)
      return Promise.reject(new IModelError(error.status, error.message));
  }

  /** Returns true if the ECDb is open */
  public isDbOpen(): boolean {
    return this._ecdb && this._ecdb.IsDbOpen;
  }

  /** Close the Db after saving any uncommitted changes.
   * @returns Promise that resolves to an object that contains an error property if the operation failed.
   * @throws [[IModelError]] if the database is not open.
   */
  public async closeDb(): Promise<void> {
    if (!this._ecdb)
      return Promise.reject(this._newInvalidDatabaseError());

    const { error } = await this._ecdb.closeDb();
    if (error)
      return Promise.reject(new IModelError(error.status, error.message));
  }

  /** Commit the outermost transaction, writing changes to the file. Then, restart the transaction.
   * @param changeSetName The name of the operation that generated these changes.
   * @throws [[IModelError]] if the database is not open or if the operation failed.
   */
  public async saveChanges(changeSetName?: string): Promise<void> {
    if (!this._ecdb)
      return Promise.reject(this._newInvalidDatabaseError());

    const { error } = await this._ecdb.saveChanges(changeSetName);
    if (error)
      return Promise.reject(new IModelError(error.status, error.message));
  }

  /** Abandon (cancel) the outermost transaction, discarding all changes since last save. Then, restart the transaction.
   * @throws [[IModelError]] if the database is not open or if the operation failed.
   */
  public async abandonChanges(): Promise<void> {
    if (!this._ecdb)
      return Promise.reject(this._newInvalidDatabaseError());

    const { error } = await this._ecdb.abandonChanges();
    if (error)
      return Promise.reject(new IModelError(error.status, error.message));
  }

  /** Import a schema. If the import was successful, the database is automatically saved to disk.
   * @throws [[IModelError]] if the database is not open or if the operation failed.
   */
  public async importSchema(pathname: string): Promise<void> {
    if (!this._ecdb)
      return Promise.reject(this._newInvalidDatabaseError());

    const { error } = await this._ecdb.importSchema(pathname);
    if (error)
      return Promise.reject(new IModelError(error.status, error.message));
  }

  /** Insert an instance. This method is not meant for bulk inserts.
   * @returns Promise that resolves to an object with a result property set to the id of the inserted instance.
   * The resolved object contains an error property if the operation failed.
   * @throws [[IModelError]] if the database is not open or if the operation failed.
   */
  public async insertInstance<T extends ECInstance>(typedInstance: T): Promise<void> {
    if (!this._ecdb)
      return Promise.reject(this._newInvalidDatabaseError());

    const jsonInstance: any = ECJsonTypeMap.toJson<T>("ecdb", typedInstance);
    if (!jsonInstance)
      return Promise.reject(new IModelError(DbResult.BE_SQLITE_ERROR, "Error writing instance as JSON"));

    const { error, result: id } = await this._ecdb.insertInstance(JSON.stringify(jsonInstance));
    if (error)
      return Promise.reject(new IModelError(error.status, error.message));

    typedInstance.id = id;
  }

  /** Read an instance
   * @description This method is not meant for bulk reads.
   * @returns Promise that resolves to an object with a result property set to the instance that was read from the Db.
   * The resolved object contains an error property if the operation failed.
   * @throws [[IModelError]] if the database is not open.
   */
  public async readInstance<T extends ECInstance>(typedInstanceKey: T): Promise<T> {
    if (!this._ecdb)
      return Promise.reject(this._newInvalidDatabaseError());

    const jsonInstanceKey: any = ECJsonTypeMap.toJson<T>("ecdb", typedInstanceKey);
    if (!jsonInstanceKey)
      return Promise.reject(new IModelError(DbResult.BE_SQLITE_ERROR, "Invalid key. Check that the typescript class is mapped to JSON properly"));

    const { error, result: untypedInstanceStr } = await this._ecdb.readInstance(JSON.stringify(jsonInstanceKey));
    if (error)
      return Promise.reject(new IModelError(error.status, error.message));

    const untypedInstance = JSON.parse(untypedInstanceStr);
    const typedConstructor = Object.getPrototypeOf(typedInstanceKey).constructor;
    const typedInstance: T | undefined = ECJsonTypeMap.fromJson<T>(typedConstructor, "ecdb", untypedInstance);
    if (!typedInstance)
      return Promise.reject(new IModelError(DbResult.BE_SQLITE_ERROR, "Error reading instance"));

    return typedInstance;
  }

  /** Update an instance. This method is not meant for bulk updates.
   * @throws [[IModelError]] if the database is not open or if the operation failed.
   */
  public async updateInstance<T extends ECInstance>(typedInstance: T): Promise<void> {
    if (!this._ecdb)
      return Promise.reject(this._newInvalidDatabaseError());

    const untypedInstance: any = ECJsonTypeMap.toJson<T>("ecdb", typedInstance);
    const { error } = await this._ecdb.updateInstance(JSON.stringify(untypedInstance));
    if (error)
      return Promise.reject(new IModelError(error.status, error.message));
  }

  /** Delete an instance. This method is not meant for bulk deletes.
   * @throws [[IModelError]] if the database is not open or if the operation failed.
   */
  public async deleteInstance<T extends ECInstance>(typedInstanceKey: T): Promise<void> {
    if (!this._ecdb)
      return Promise.reject(this._newInvalidDatabaseError());

    const jsonInstanceKey: any = ECJsonTypeMap.toJson<T>("ecdb", typedInstanceKey);
    const { error } = await this._ecdb.deleteInstance(JSON.stringify(jsonInstanceKey));
    if (error)
      return Promise.reject(new IModelError(error.status, error.message));
  }

  /** Check if an instance exists
   * @returns True or false depending on whether the Db contains the instance with the specified key.
   * @throws [[IModelError]] if the database is not open.
   */
  public async containsInstance<T extends ECInstance>(typedInstanceKey: T): Promise<boolean> {
    if (!this._ecdb)
      return Promise.reject(this._newInvalidDatabaseError());

    const jsonInstanceKey: any = ECJsonTypeMap.toJson<T>("ecdb", typedInstanceKey);
    const { error, result } = await this._ecdb.containsInstance(JSON.stringify(jsonInstanceKey));
    if (error)
      return Promise.reject(new IModelError(error.status, error.message));

    return result;
  }

  /** Execute an ECSql query returning all rows as an array of objects in JSON syntax.
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
   * @throws [[IModelError]] if the database is not open or if the operation failed.
   */
  public async executeQuery(ecsql: string, bindings?: BindingValue[] | Map<string, BindingValue> | any): Promise<any[]> {
    if (!this._ecdb)
      return Promise.reject(this._newInvalidDatabaseError());

    let ecBindingsStr: string | undefined;
    if (bindings) {
      const { error, result: ecBindings } = BindingUtility.preProcessBindings(bindings);
      if (error)
        return Promise.reject(new IModelError(error.status, error.message));
      ecBindingsStr = JSON.stringify(ecBindings);
    }

    const { error: queryError, result: rowsJson } = await this._ecdb.executeQuery(ecsql, ecBindingsStr);
    if (queryError) {
      return Promise.reject(new IModelError(queryError.status, queryError.message));
    }
    if (rowsJson === undefined) {
      return Promise.reject(new IModelError(DbResult.BE_SQLITE_ERROR));
    }
    return JSON.parse(rowsJson);
  }

  /** Execute an ECSql statement
   * @param ecsql ECSql string
   * @param bindings Optional bindings required to execute the statement.
   * @returns Promise that resolves to an object that contains an error property if the operation failed.
   * If the operation was successful and it was an insert, the returned object will contain a result property set to the id of the inserted instance.
   * @throws [[IModelError]] if the database is not open.
   */
  public async executeStatement(ecsql: string, isInsertStatement?: boolean, bindings?: BindingValue[] | Map<string, BindingValue> | any): Promise<string> {
    if (!this._ecdb)
      return Promise.reject(this._newInvalidDatabaseError());

    let ecBindingsStr: string | undefined;
    if (bindings) {
      const { error: bindingError, result: ecBindings } = BindingUtility.preProcessBindings(bindings);
      if (bindingError)
        return Promise.reject(new IModelError(bindingError.status, bindingError.message));
      ecBindingsStr = JSON.stringify(ecBindings);
    }

    const { error, result } = await this._ecdb.executeStatement(ecsql, isInsertStatement, ecBindingsStr);
    if (error)
      return Promise.reject(new IModelError(error.status, error.message));

    return result;
  }
}
