/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECDb
 */
import { DbResult, GuidString, Id64String, IDisposable } from "@itwin/core-bentley";
import { AnyDb, SqliteChange, SqliteChangeOp, SqliteChangesetReader, SqliteValueStage } from "./SqliteChangesetReader";

interface IClassRef {
  classId: Id64String;
  classFullName: string;
}

interface IClassMap {
  readonly id: Id64String;
  readonly name: string;
  readonly mapStrategy: "NotMapped" | "OwnTable" | "TablePerHierarchy" | "ExistingTable" | "ForeignKeyInTargetTable" | "ForeignKeyInSourceTable";
  readonly type: "Entity" | "Relationship" | "Struct" | "CustomAttribute";
  readonly modifier: "None" | "Abstract" | "Sealed";
  readonly properties: IProperty[];
}

interface IDateTimeInfo {
  readonly dateTimeKind?: "Utc" | "Local" | "Unspecified";
  readonly dateTimeComponent?: "DateTime" | "Date" | "TimeOfDay";
}

interface IProperty {
  readonly id: Id64String;
  readonly name: string;
  readonly kind: "Primitive" | "Struct" | "PrimitiveArray" | "StructArray" | "Navigation";
  readonly primitiveType?: "Binary" | "Boolean" | "DateTime" | "Double" | "Integer" | "Long" | "Point2d" | "Point3d" | "String" | "IGeometry";
  readonly extendedTypeName?: string;
  readonly navigationRelationship?: IClassRef;
  readonly structClass?: IClassRef;
  readonly dateTimeInfo?: IDateTimeInfo;
  readonly columns: IColumn[];

}

interface IColumn {
  readonly table: string;
  readonly column: string;
  readonly type: "Any" | "Boolean" | "Blob" | "Timestamp" | "Real" | "Integer" | "Text";
  readonly columnKind: "Default" | "Id" | "ClassId" | "Shared";
  readonly accessString: string;
  readonly isVirtual: boolean;
}

interface ITable {
  readonly id: Id64String;
  readonly name: string;
  readonly type: "Primary" | "Joined" | "Existing" | "Overflow" | "Virtual";
  readonly exclusiveRootClassId: Id64String;
  readonly isClassIdVirtual: boolean;
}

class ECDbMap {
  private _cachedClassMaps = new Map<Id64String, IClassMap>();
  private _cacheTables = new Map<string, ITable>();
  public constructor(public readonly db: AnyDb) { }
  public getAllDerivedClasses(classFullName: string) {
    const sql = `
      SELECT format('0x%x', ch.ClassId)
      FROM   [ec_cache_ClassHierarchy] [ch]
            JOIN [ec_Class] [cs] ON [cs].[Id] = [ch].[BaseClassId]
            JOIN [ec_Schema] [sc] ON [sc].[Id] = [cs].[SchemaId]
      WHERE  (([sc].[Alias] = :schemaNameOrAlias
              OR [sc].[Name] = :schemaNameOrAlias)
              AND ([cs].[Name] = :className))
    `;
    return this.db.withPreparedSqliteStatement(sql, (stmt) => {
      const parts = classFullName.indexOf(".") !== -1 ? classFullName.split(".") : classFullName.split(":");
      stmt.bindString(":schemaNameOrAlias", parts[0]);
      stmt.bindString(":className", parts[1]);
      const classIds = [];
      while (stmt.step() === DbResult.BE_SQLITE_ROW)
        classIds.push(stmt.getValueString(0));
      return classIds;
    });
  }
  public getTable(tableName: string): ITable | undefined {
    if (this._cacheTables.has(tableName))
      return this._cacheTables.get(tableName);

    const sql = `
      SELECT
        JSON_OBJECT (
          'id', FORMAT ('0x%x', [t].[id]),
          'name', [t].[Name],
          'type', (
            CASE
              [t].[type]
              WHEN 0 THEN 'Primary'
              WHEN 1 THEN 'Joined'
              WHEN 2 THEN 'Existing'
              WHEN 3 THEN 'Overflow'
              WHEN 4 THEN 'Virtual'
            END
          ),
          'exclusiveRootClassId', FORMAT ('0x%x', [t].[ExclusiveRootClassId]),
          'isClassIdVirtual', (
            SELECT
              [c].[IsVirtual]
            FROM
              [ec_Column] [c]
            WHERE
              [c].[Name] = 'ECClassId' AND [c].[TableId] = [t].[Id]
          )
        )
      FROM [ec_Table] [t]
      WHERE
        [t].[Name] = ?;
    `;

    return this.db.withPreparedSqliteStatement(sql, (stmt) => {
      stmt.bindString(1, tableName);
      if (stmt.step() === DbResult.BE_SQLITE_ROW) {
        const table = JSON.parse(stmt.getValueString(0), (key, value) => {
          if (value === null)
            return undefined;

          if (key === "isClassIdVirtual")
            return value === 0 ? false : true;

          return value;
        }) as ITable;

        this._cacheTables.set(tableName, table);
        return table;
      }
      return undefined;
    });
  }
  public getClassMap(classId: Id64String): IClassMap | undefined {
    if (this._cachedClassMaps.has(classId))
      return this._cachedClassMaps.get(classId);

    const sql = `
      SELECT
      JSON_OBJECT(
        'id', format('0x%x', cs.id),
        'name', format('%s:%s', ss.Name, cs.Name),
        'mapStrategy',
        (
          CASE cm.MapStrategy
            WHEN 0 THEN 'NotMapped'
            WHEN 1 THEN 'OwnTable'
            WHEN 2 THEN 'TablePerHierarchy'
            WHEN 3 THEN 'ExistingTable'
            WHEN 10 THEN 'ForeignKeyInTargetTable'
            WHEN 11 THEN 'ForeignKeyInSourceTable'
          END
        ),
        'type',
        (
          CASE cs.Type
            WHEN 0 THEN 'Entity'
            WHEN 1 THEN 'Relationship'
            WHEN 2 THEN 'Struct'
            WHEN 3 THEN 'CustomAttribute'
          END
        ),
        'modifier',
        (
          CASE cs.Modifier
            WHEN 0 THEN 'None'
            WHEN 1 THEN 'Abstract'
            WHEN 2 THEN 'Sealed'
          END
        ),
        'properties',
        (
          SELECT
            JSON_GROUP_ARRAY(JSON(propJson))
          FROM
            (
              SELECT
                JSON_OBJECT(
                  'id', format('0x%x', pt.id),
                  'name', pt.Name,
                  'kind',
                  (
                    CASE pt.Kind
                      WHEN 0 THEN 'Primitive'
                      WHEN 1 THEN 'Struct'
                      WHEN 2 THEN 'PrimitiveArray'
                      WHEN 3 THEN 'StructArray'
                      WHEN 4 THEN 'Navigation'
                    END
                  ),
                  'primitiveType',
                  (
                    CASE pt.PrimitiveType
                      WHEN 0x101 THEN 'Binary'
                      WHEN 0x201 THEN 'Boolean'
                      WHEN 0x301 THEN 'DateTime'
                      WHEN 0x401 THEN 'Double'
                      WHEN 0x501 THEN 'Integer'
                      WHEN 0x601 THEN 'Long'
                      WHEN 0x701 THEN 'Point2d'
                      WHEN 0x801 THEN 'Point3d'
                      WHEN 0x901 THEN 'String'
                      WHEN 0xa01 THEN 'IGeometry'
                    END
                  ),
                  'extendedTypeName', ExtendedTypeName,
                  'navigationRelationship',
                  (
                    SELECT
                      JSON_OBJECT(
                        'classId', format('0x%x', nc.Id),
                        'classFullName', format('%s:%s', ns.Name, nc.Name)
                      )
                    FROM ec_Class nc
                      JOIN ec_Schema ns ON ns.Id = nc.SchemaId
                    WHERE
                      nc.Id = pt.NavigationRelationshipClassId
                  ),
                  'structClass',
                  (
                    SELECT
                      JSON_OBJECT(
                        'classId', format('0x%x', nc.Id),
                        'classFullName', format('%s:%s', ns.Name, nc.Name)
                      )
                    FROM ec_Class nc
                      JOIN ec_Schema ns ON ns.Id = nc.SchemaId
                    WHERE
                      nc.Id = pt.StructClassId
                  ),
                  'dateTimeInfo', (
                      SELECT
                      JSON_OBJECT (
                        'dateTimeKind', (
                          CASE
                            WHEN [ca].[Instance] LIKE '%<DateTimeKind>Utc</DateTimeKind>%' COLLATE [NoCase] THEN 'Utc'
                            WHEN [ca].[Instance] LIKE '%<DateTimeKind>Local</DateTimeKind>%' COLLATE [NoCase] THEN 'Local'
                            ELSE 'Unspecified'
                          END
                        ),
                        'dateTimeComponent', (
                          CASE
                            WHEN [ca].[Instance] LIKE '%<DateTimeComponent>DateTime</DateTimeComponent>%' COLLATE [NoCase] THEN 'DateTime'
                            WHEN [ca].[Instance] LIKE '%<DateTimeComponent>Date</DateTimeComponent>%' COLLATE [NoCase] THEN 'Date'
                            WHEN [ca].[Instance] LIKE '%<DateTimeComponent>TimeOfDay</DateTimeComponent>%' COLLATE [NoCase] THEN 'TimeOfDay'
                            ELSE 'DateTime'
                          END
                        )
                      )
                    FROM
                      [ec_CustomAttribute] [ca]
                      JOIN [ec_Class] [cl] ON [cl].[Id] = [ca].[ClassId]
                      JOIN [ec_Schema] [sc] ON [sc].[Id] = [cl].[SchemaId]
                    WHERE
                      [ca].[ContainerType] = 992
                      AND [cl].[Name] = 'DateTimeInfo'
                      AND [sc].[Name] = 'CoreCustomAttributes'
                      AND [ca].[ContainerId] = [pt].[Id]
                  ),
                  'columns',
                  (
                    SELECT
                      JSON_GROUP_ARRAY(JSON(columnJson))
                    FROM
                      (
                        SELECT
                          JSON_OBJECT(
                            'table', tb.Name,
                            'column', cc.Name,
                            'type',
                            (
                              CASE cc.Type
                                WHEN 0 THEN 'Any'
                                WHEN 1 THEN 'Boolean'
                                WHEN 2 THEN 'Blob'
                                WHEN 3 THEN 'Timestamp'
                                WHEN 4 THEN 'Real'
                                WHEN 5 THEN 'Integer'
                                WHEN 6 THEN 'Text'
                              END
                            ),
                            'columnKind',
                            (
                              CASE cc.ColumnKind
                                WHEN 0 THEN 'Default'
                                WHEN 1 THEN 'Id'
                                WHEN 2 THEN 'ClassId'
                                WHEN 4 THEN 'SharedData'
                              END
                            ),
                            'accessString', pp0.AccessString,
                            'isVirtual', cc.IsVirtual OR tb.Type = 4
                          ) columnJson
                        FROM [ec_PropertyMap] [pm0]
                          JOIN [ec_Column] [cc] ON [cc].[Id] = [pm0].[ColumnId]
                          JOIN [ec_Table] [tb] ON [tb].[Id] = [cc].[TableId]
                          JOIN [ec_PropertyPath] [pp0] ON [pp0].[Id] = [pm0].[PropertyPathId]
                        WHERE
                          [pp0].[RootPropertyId] = pt.Id AND pm0.ClassId = cs.Id
                      )
                  )
                ) propJson
              FROM [ec_PropertyMap] [pm]
                JOIN [ec_PropertyPath] [pp] ON [pp].[Id] = [pm].[PropertyPathId]
                JOIN [ec_Property] [pt] ON [pt].[Id] = [pp].[RootPropertyId]
              WHERE
                pm.ClassId = cs.Id
              GROUP BY
                pt.Id
            )
        )
      ) classDef
    FROM [ec_Class] [cs]
      JOIN [ec_ClassMap] [cm] ON [cm].[ClassId] = [cs].[Id]
      JOIN [ec_Schema] [ss] ON [ss].[Id] = [cs].[SchemaId]
    WHERE
      [cs].[Id] = ?
    `;

    return this.db.withPreparedSqliteStatement(sql, (stmt) => {
      stmt.bindId(1, classId);
      if (stmt.step() === DbResult.BE_SQLITE_ROW) {
        const classMap = JSON.parse(stmt.getValueString(0), (key, value) => {
          if (value === null) {
            return undefined;
          }
          if (key === "isVirtual") {
            return value === 0 ? false : true;
          }
          return value;
        }) as IClassMap;

        this._cachedClassMaps.set(classId, classMap);
        return classMap;
      }
      return undefined;
    });
  }
}

/**
 * Record meta data for the change.
 * @beta
 * */
export interface ChangeMetaData {
  /** list of tables making up this EC change */
  tables: string[];
  /** full name of the class of this EC change */
  classFullName?: string;
  /** sqlite operation that caused the change */
  op: SqliteChangeOp;
  /** version of the value read from sqlite change */
  stage: SqliteValueStage;
  /** if classId for the change was not found in db then fallback class for the table */
  fallbackClassId?: Id64String;
  /** list of change index making up this change (one per table) */
  changeIndexes: number[];
}

/**
 * Represent EC change derived from low level sqlite change
 * @beta
 */
export interface ChangedECInstance {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  ECInstanceId: Id64String;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  ECClassId?: Id64String;
  $meta?: ChangeMetaData;
  [key: string]: any;
}

/**
 * Helper function to convert between JS DateTime & SQLite JulianDay values.
 * @beta
 * */
namespace DateTime {
  /**
   * Convert JS date to JulianDay value.
   * @param dt JS Date object.
   * @param convertToUtc convert the input value to UTC.
   * @returns julian day value
   */
  export function toJulianDay(dt: Date, convertToUtc = true): number {
    const utcOffset = convertToUtc ? dt.getTimezoneOffset() / 1440 : 0;
    return (dt.valueOf() / 86400000) - utcOffset + 2440587.5;
  }
  /**
   * Convert Julian day to JS Date object
   * @param jd JulianDay value for date/time
   * @param isLocalTime if julian day is local time or UTC
   * @returns JS Date object.
   */
  export function fromJulianDay(jd: number, isLocalTime: boolean): Date {
    const utcOffset = isLocalTime ? 0 : new Date().getTimezoneOffset() / 1440;
    return new Date((jd - 2440587.5 + utcOffset) * 86400000);
  }
}
/**
 * Combine partial changed instance into single instance.
 * Partial changes is per table and a single instance can
 * span multiple tables.
 * @beta
 */
export class PartialECChangeUnifier {
  private _cache = new Map<string, ChangedECInstance>();
  private _readonly = false;
  /**
   * Combine partial instance with instance with same key if already exists.
   * @param rhs partial instance
   */
  private combine(rhs: ChangedECInstance): void {
    if (!rhs.$meta) {
      throw new Error("PartialECChange being combine must have '$meta' property");
    }
    const key = PartialECChangeUnifier.buildKey(rhs);
    const lhs = this._cache.get(key);
    if (lhs) {
      const { $meta: _, ...restOfRhs } = rhs;
      Object.assign(lhs, restOfRhs);
      if (lhs.$meta && rhs.$meta) {
        lhs.$meta.tables = [...rhs.$meta?.tables, ...lhs.$meta?.tables];
        lhs.$meta.changeIndexes = [...rhs.$meta?.changeIndexes, ...lhs.$meta?.changeIndexes];
      }
    } else {
      this._cache.set(key, rhs);
    }
  }
  /**
   * Build key from EC change.
   * @param change EC change
   * @returns key created from EC change.
   */
  private static buildKey(change: ChangedECInstance): string {
    return `${change.ECClassId}-${change.ECInstanceId}-${change.$meta?.stage}`.toLowerCase();
  }
  /**
   * Append partial changes which will be combine using there instance key.
   * @note $meta property must be present on partial change as information
   * in it is used to combine partial instances.
   * @param adaptor changeset adaptor is use to read the partial EC change.
   * @beta
   */
  public appendFrom(adaptor: ChangesetECAdaptor): void {
    if (adaptor.disableMetaData) {
      throw new Error("change adaptor property 'disableMetaData' must be set to 'false'");
    }
    if (this._readonly) {
      throw new Error("this instance is marked as readonly.");
    }
    if (adaptor.op === "Updated" && adaptor.inserted && adaptor.deleted) {
      this.combine(adaptor.inserted);
      this.combine(adaptor.deleted);
    } else if (adaptor.op === "Inserted" && adaptor.inserted) {
      this.combine(adaptor.inserted);
    } else if (adaptor.op === "Deleted" && adaptor.deleted) {
      this.combine(adaptor.deleted);
    }
  }
  /**
   * Delete $meta from all the instances.
   */
  public stripMetaData(): void {
    for (const inst of this._cache.values()) {
      if ("$meta" in inst) {
        delete inst.$meta;
      }
    }
    this._readonly = true;
  }
  /**
   * Returns complete EC change instances.
   * @beta
   */
  public get instances(): IterableIterator<ChangedECInstance> { return this._cache.values(); }
}

/**
 * Transform sqlite change to ec change. EC change is partial change as
 * it is per table while a single instance can span multiple table.
 * @note PrimitiveArray and StructArray are not supported types.
 * @beta
 *
*/
export class ChangesetECAdaptor implements IDisposable {
  private readonly _mapCache: ECDbMap;
  private readonly _tableFilter = new Set<string>();
  private readonly _opFilter = new Set<SqliteChangeOp>();
  private readonly _classFilter = new Set<string>();
  private _allowedClasses = new Set<string>();
  /**
   * set debug flags
   */
  public readonly debugFlags = {
    replaceBlobWithEllipsis: false, // replace bolb with ... for debugging
    replaceGeomWithEllipsis: false, // replace geom with ... for debugging
    replaceGuidWithEllipsis: false, // replace geom with ... for debugging
  };
  /**
   * Return partial inserted instance
   * For updates inserted represent new version of instance after update.
   */
  public inserted?: ChangedECInstance;
  /**
   * Return partial deleted instance.
   * For updates deleted represent old version of instance before update.
   */
  public deleted?: ChangedECInstance;

  /**
   * Setup filter that will result in change enumeration restricted to
   * list of tables added by acceptTable().
   * @param table Name of the table
   * @returns Fluent reference to ChangesetAdaptor.
   */
  public acceptTable(table: string): ChangesetECAdaptor {
    if (!this._tableFilter.has(table))
      this._tableFilter.add(table);
    return this;
  }
  /**
   * Setup filter that will result in change enumeration restricted to
   * list of op added by acceptOp().
   * @param op
   * @returns Fluent reference to ChangesetAdaptor.
   */
  public acceptOp(op: SqliteChangeOp): ChangesetECAdaptor {
    if (!this._opFilter.has(op))
      this._opFilter.add(op);
    return this;
  }
  /**
   * Setup filter that will result in change enumeration restricted to
   * list of class and its derived classes added by acceptClass().
   * @param classFullName
   * @returns
   */
  public acceptClass(classFullName: string): ChangesetECAdaptor {
    if (!this._classFilter.has(classFullName))
      this._classFilter.add(classFullName);

    this._allowedClasses.clear();
    return this;
  }
  private buildClassFilter() {
    if (this._allowedClasses.size !== 0 || this._classFilter.size === 0)
      return;

    this._classFilter.forEach((className) => {
      this._mapCache.getAllDerivedClasses(className).forEach((classId) => {
        this._allowedClasses.add(classId);
      });
    });
  }
  /**
   * Construct adaptor with a initialized reader.
   * @note the changeset reader must have disableSchemaCheck
   * set to false and db must also be set.
   * @param reader wrap changeset reader.
   */
  public constructor(public readonly reader: SqliteChangesetReader, public readonly disableMetaData = false) {
    if (!reader.db)
      throw new Error("SqliteChangesetReader, 'db' param must be set to a valid IModelDb or ECDb.");

    if (!reader.disableSchemaCheck)
      throw new Error("SqliteChangesetReader, 'disableSchemaCheck' param must be set to false.");

    this._mapCache = new ECDbMap(reader.db);
  }
  /**
   * dispose current instance and it will also dispose the changeset reader.
   */
  public dispose(): void {
    this.close();
  }
  /**
   * close current instance and it will also close the changeset reader.
   */
  public close(): void {
    this.reader.close();
  }
  /**
   * Convert binary GUID into string GUID.
   * @param binaryGUID binary version of guid.
   * @returns GUID string.
   */
  private static convertBinaryToGuid(binaryGUID: Uint8Array): GuidString {
    // Check if the array has 16 elements
    if (binaryGUID.length !== 16) {
      throw new Error("Invalid array length for Guid");
    }
    // Convert each element to a two-digit hexadecimal string
    const hex = Array.from(binaryGUID, (byte) => byte.toString(16).padStart(2, "0"));
    // Join the hexadecimal strings and insert hyphens
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;

  }
  /**
   * Set value use access string in a JS object.
   * @param targetObj object that will be updated.
   * @param accessString access string token separated by '.'.
   */
  private static setValue(targetObj: any, accessString: string, value: any): void {
    let cursor = targetObj;
    const propPath = accessString.split(".");
    propPath.forEach((propertyName) => {
      if (propertyName === "__proto__")
        throw new Error("access string cannot container __proto__");
    });

    const leafProp = propPath.splice(-1).shift();
    if (!leafProp)
      throw new Error("not access string was specified.");

    for (const elem of propPath) {
      if (typeof cursor[elem] === "undefined")
        cursor[elem] = {};
      cursor = cursor[elem];
    }
    cursor[leafProp] = value;
  }

  /**
   * Check if sqlite change table is a EC data table
   * @param tableName name of the table.
   * @returns true if table has EC data.
   */
  public isECTable(tableName: string) {
    return typeof this._mapCache.getTable(tableName) !== "undefined";
  }
  /**
   * Attempt find ECClassId from ECInstanceId for a change of type 'updated'.
   * @param tableName name of the table to find ECClassId from given ECInstanceId
   * @param instanceId instance id for which we need ECClassId for.
   * @returns if successful returns ECClassId else return undefined.
   */
  private getClassIdFromDb(tableName: string, instanceId: Id64String): Id64String | undefined {
    try {
      return this.reader.db?.withPreparedSqliteStatement(`SELECT [ECClassId] FROM [${tableName}] WHERE [rowId]=?`, (stmt) => {
        stmt.bindId(1, instanceId);
        return stmt.step() === DbResult.BE_SQLITE_ROW ? stmt.getValueId(0) : undefined;
      });
    } catch {
      return undefined;
    }
  }
  /** helper method around reader.op */
  public get op() { return this.reader.op; }
  /** Return true if current change is of type "Inserted" */
  public get isInserted() { return this.op === "Inserted"; }
  /** Return true if current change is of type "Deleted" */
  public get isDeleted() { return this.op === "Deleted"; }
  /** Return true if current change is of type "Updated" */
  public get isUpdated() { return this.op === "Updated"; }

  /**
   * Advance reader to next change or a change that meets the filter set in the current adaptor
   * @returns return false if no more changes to read.
   */
  public step(): boolean {
    this.inserted = undefined;
    this.deleted = undefined;
    this.buildClassFilter();
    while (this.reader.step()) {
      if (!this.isECTable(this.reader.tableName))
        continue;

      if (this._tableFilter.size > 0) {
        if (!this._tableFilter.has(this.reader.tableName))
          continue;
      }

      if (this._opFilter.size > 0) {
        if (!this._opFilter.has(this.reader.op))
          continue;
      }

      if (this.reader.hasRow) {
        const table = this._mapCache.getTable(this.reader.tableName);
        if (!table || table.type === "Virtual") {
          throw new Error(`table in changeset not found or is virtual ${this.reader.tableName}`);
        }

        const change = {
          inserted: this.reader.getChangeValuesObject("New", { includePrimaryKeyInUpdateNew: true }),
          deleted: this.reader.getChangeValuesObject("Old", { includePrimaryKeyInUpdateNew: true }),
        };

        if (!change.inserted && !change.deleted) {
          throw new Error(`unable to get change from changeset reader`);
        }

        let ecClassId: Id64String | undefined = this.reader.op === "Inserted" ? change.inserted?.ECClassId : change.deleted?.ECClassId;
        const classIdPresentInChange = !ecClassId;
        let classMap: IClassMap | undefined;
        let fallbackClassId: Id64String | undefined;
        if (table.isClassIdVirtual) {
          classMap = this._mapCache.getClassMap(table.exclusiveRootClassId);
        } else {
          if (!ecClassId) {
            // attempt to find ECClassId against row from the db.
            const primaryKeys = this.reader.primaryKeyValues;
            if (primaryKeys.length === 1) {
              ecClassId = this.getClassIdFromDb(this.reader.tableName, this.reader.primaryKeyValues[0] as Id64String);
            }
          }
          if (ecClassId)
            classMap = this._mapCache.getClassMap(ecClassId);
          if (!classMap) {
            // fallback to root map for table.
            classMap = this._mapCache.getClassMap(table.exclusiveRootClassId);
            if (classMap)
              fallbackClassId = table.exclusiveRootClassId;
          }
        }

        if (!classMap)
          throw new Error(`unable to load class map`);

        if (!classIdPresentInChange && !ecClassId)
          ecClassId = classMap.id;

        if (this._allowedClasses.size !== 0) {
          if (!this._allowedClasses.has(classMap.id))
            continue;
        }

        const $meta = {
          tables: [this.reader.tableName],
          op: this.reader.op,
          classFullName: classMap.name,
          fallbackClassId,
          changeIndexes: [this.reader.changeIndex],
        };

        if (this.reader.op === "Inserted" && change.inserted) {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          this.inserted = { ECClassId: ecClassId, ECInstanceId: "" };
          if (!this.disableMetaData)
            this.inserted.$meta = { ...$meta, stage: "New" };
          this.transform(classMap, change.inserted, table, this.inserted);
        } else if (this.reader.op === "Deleted" && change.deleted) {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          this.deleted = { ECClassId: ecClassId, ECInstanceId: "" };
          if (!this.disableMetaData)
            this.deleted.$meta = { ...$meta, stage: "Old" };
          this.transform(classMap, change.deleted, table, this.deleted);
        } else if (change.inserted && change.deleted) {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          this.inserted = { ECClassId: ecClassId, ECInstanceId: "" };
          if (!this.disableMetaData)
            this.inserted.$meta = { ...$meta, stage: "New" };
          this.transform(classMap, change.inserted, table, this.inserted);
          // eslint-disable-next-line @typescript-eslint/naming-convention
          this.deleted = { ECClassId: ecClassId, ECInstanceId: "" };
          if (!this.disableMetaData)
            this.deleted.$meta = { ...$meta, stage: "Old" };
          this.transform(classMap, change.deleted, table, this.deleted);
        } else {
          throw new Error("unable to read EC changes");
        }
        break;
      }
    }
    return this.reader.hasRow;
  }
  /**
   * Transform nav change column into navigation EC property
   * @param prop navigation property definition.
   * @param change sqlite change.
   * @param out ec instance that will be updated with navigation property.
   */
  private transformNavigationProperty(prop: IProperty, change: SqliteChange, out: ChangedECInstance): void {
    const idCol = prop.columns.filter(($) => $.accessString.endsWith(".Id")).at(0);
    if (!idCol) {
      throw new Error("invalid map for nav property");
    }

    const idValue = change[idCol.column];
    if (typeof idValue === "undefined")
      return;

    ChangesetECAdaptor.setValue(out, idCol.accessString, idValue);

    const relClassIdCol = prop.columns.filter(($) => $.accessString.endsWith(".RelECClassId")).at(0);
    if (!relClassIdCol) {
      throw new Error("invalid map for nav property");
    }

    const relClassIdValue = relClassIdCol.isVirtual ? prop.navigationRelationship?.classId : change[relClassIdCol.column];
    if (typeof relClassIdValue === "undefined")
      return;

    ChangesetECAdaptor.setValue(out, relClassIdCol.accessString, relClassIdValue);
  }
  /**
   * Transform sqlite change into EC change.
   * @param classMap classMap use to deserialize sqlite change into EC change.
   * @param change sqlite change from changeset.
   * @param table table definition of sqlite change provided.
   * @param out EC changeset that will be updated with properties.
   */
  private transform(classMap: IClassMap, change: SqliteChange, table: ITable, out: ChangedECInstance): void {
    // transform change row to instance
    for (const prop of classMap.properties) {
      if (prop.kind === "PrimitiveArray" || prop.kind === "StructArray") {
        // Arrays not supported
        continue;
      }
      if (prop.columns.filter((_) => _.isVirtual).length === prop.columns.length) {
        continue;
      }
      if (prop.kind === "Navigation") {
        this.transformNavigationProperty(prop, change, out);
      } else {
        for (const col of prop.columns) {
          if (col.table !== table.name)
            continue;

          const columnValue = change[col.column];
          if (typeof columnValue === "undefined")
            continue;

          if (columnValue !== null) {
            if (prop.primitiveType === "DateTime") {
              const dt = DateTime.fromJulianDay(columnValue, prop.dateTimeInfo?.dateTimeKind === "Local");
              ChangesetECAdaptor.setValue(out, col.accessString, dt.toISOString());
              continue;
            }
            if (prop.extendedTypeName === "BeGuid") {
              ChangesetECAdaptor.setValue(out, col.accessString, this.debugFlags.replaceGuidWithEllipsis ? "..." : ChangesetECAdaptor.convertBinaryToGuid(columnValue));
              continue;
            }
            if (prop.extendedTypeName === "GeometryStream") {
              ChangesetECAdaptor.setValue(out, col.accessString, this.debugFlags.replaceGeomWithEllipsis ? "..." : columnValue);
              continue;
            }
            if (prop.primitiveType === "Binary") {
              ChangesetECAdaptor.setValue(out, col.accessString, this.debugFlags.replaceBlobWithEllipsis ? "..." : columnValue);
              continue;
            }
          }
          ChangesetECAdaptor.setValue(out, col.accessString, columnValue);
        }
      }
    }
  }
}
