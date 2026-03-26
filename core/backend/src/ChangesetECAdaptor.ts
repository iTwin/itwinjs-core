/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECDb
 */
import { DbResult, Guid, GuidString, Id64String } from "@itwin/core-bentley";
import { AnyDb, SqliteChange, SqliteChangeOp, SqliteChangesetReader, SqliteValueStage } from "./SqliteChangesetReader";
import { Base64EncodedString } from "@itwin/core-common";
import { ECDb } from "./ECDb";
import { _nativeDb } from "./internal/Symbols";

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
        'exclusiveRootClassId', FORMAT ('0x%x',
          COALESCE (
            [t].[ExclusiveRootClassId], (
              SELECT [parent].[ExclusiveRootClassId]
              FROM [ec_Table] [parent]
              WHERE [parent].[Id] = [t].[ParentTableId] AND [parent].[Type] = 1))),
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
 * Represents a cache for unifying EC changes.
 * @beta
 */
export interface ECChangeUnifierCache extends Disposable {
  /**
   * Retrieves the value associated with the specified key from the cache.
   * @param key - The key to retrieve the value for.
   * @returns The value associated with the key, or undefined if the key is not found.
   */
  get(key: string): ChangedECInstance | undefined;

  /**
   * Sets the value associated with the specified key in the cache.
   * @param key - The key to set the value for.
   * @param value - The value to be associated with the key.
   */
  set(key: string, value: ChangedECInstance): void;

  /**
   * Returns an iterator for all the values in the cache.
   * @returns An iterator for all the values in the cache.
   */
  all(): IterableIterator<ChangedECInstance>;

  /**
   * Returns the number of entries in the cache.
   * @returns The number of entries in the cache.
   */
  count(): number;
}
/** @beta */
export namespace ECChangeUnifierCache {
  /**
   * Creates and returns a new in-memory cache for EC change unification.
   * @note This cache is fast but recommended for small to medium size changesets. As it store changes in memory using a hash map, it may run out of memory for larger changesets.
   * @returns {ECChangeUnifierCache} An instance of cache that store changes in memory using a hash map.
   */
  export function createInMemoryCache(): ECChangeUnifierCache {
    return new InMemoryInstanceCache();
  }

  /**
   * Creates an ECChangeUnifierCache that is backed by a database.
   * @note This cache is suitable for larger changesets and uses SQLite to store changes. It is slower than the in-memory cache but can handle larger datasets without running out of memory.
   * @param db - The database instance to use for caching.
   * @param bufferedReadInstanceSizeInBytes - The size in bytes for buffered read instances. Defaults to 10 MB.
   * @returns An instance of ECChangeUnifierCache backed by SQLite temp db.
   */
  export function createSqliteBackedCache(db: AnyDb, bufferedReadInstanceSizeInBytes = 1024 * 1024 * 10): ECChangeUnifierCache {
    return new SqliteBackedInstanceCache(db, bufferedReadInstanceSizeInBytes);
  }
}

/**
 * In-memory cache for storing changed EC instances.
 */
class InMemoryInstanceCache implements ECChangeUnifierCache {
  private readonly _cache = new Map<string, ChangedECInstance>();

  /**
   * Retrieves the changed EC instance associated with the specified key.
   * @param key - The key used to retrieve the instance.
   * @returns The changed EC instance, or undefined if not found.
   */
  public get(key: string): ChangedECInstance | undefined {
    return this._cache.get(key);
  }

  /**
   * Sets the changed EC instance associated with the specified key.
   * @param key - The key used to store the instance.
   * @param value - The changed EC instance to be stored.
   */
  public set(key: string, value: ChangedECInstance): void {
    const meta = value.$meta as any;
    // Remove undefined keys
    if (meta) {
      Object.keys(meta).forEach((k) => meta[k] === undefined && delete meta[k]);
    }
    this._cache.set(key, value);
  }

  /**
   * Returns an iterator over all the changed EC instances in the cache.
   * @returns An iterator over all the changed EC instances.
   */
  public *all(): IterableIterator<ChangedECInstance> {
    for (const key of Array.from(this._cache.keys()).sort()) {
      const instance = this._cache.get(key);
      if (instance) {
        yield instance;
      }
    }
  }

  /**
   * Returns the number of changed EC instances in the cache.
   * @returns The number of changed EC instances.
   */
  public count(): number {
    return this._cache.size;
  }

  /**
   * Disposes the cache.
   */
  public [Symbol.dispose](): void {
    // Implementation details
  }
}

/**
 * Represents a cache for unifying EC changes in a SQLite-backed instance cache.
 */
class SqliteBackedInstanceCache implements ECChangeUnifierCache {
  private readonly _cacheTable = `[temp].[${Guid.createValue()}]`;
  public static readonly defaultBufferSize = 1024 * 1024 * 10; // 10MB
  /**
   * Creates an instance of SqliteBackedInstanceCache.
   * @param _db The underlying database connection.
   * @param bufferedReadInstanceSizeInBytes The size of read instance buffer defaults to 10Mb.
   * @throws Error if bufferedReadInstanceSizeInBytes is less than or equal to 0.
   */
  public constructor(private readonly _db: AnyDb, public readonly bufferedReadInstanceSizeInBytes: number = SqliteBackedInstanceCache.defaultBufferSize) {
    if (bufferedReadInstanceSizeInBytes <= 0)
      throw new Error("bufferedReadInstanceCount must be greater than 0");
    this.createTempTable();
  }

  /**
   * Creates a temporary table in the database for caching instances.
   * @throws Error if unable to create the temporary table.
   */
  private createTempTable(): void {
    this._db.withSqliteStatement(`CREATE TABLE ${this._cacheTable} ([key] text primary key, [value] text)`, (stmt) => {
      if (DbResult.BE_SQLITE_DONE !== stmt.step())
        throw new Error("unable to create temp table");
    });
  }

  /**
   * Drops the temporary table from the database.
   * @throws Error if unable to drop the temporary table.
   */
  private dropTempTable(): void {
    this._db.saveChanges();
    if (this._db instanceof ECDb)
      this._db.clearStatementCache();
    else {
      this._db.clearCaches();
    }
    this._db.withSqliteStatement(`DROP TABLE IF EXISTS ${this._cacheTable}`, (stmt) => {
      if (DbResult.BE_SQLITE_DONE !== stmt.step())
        throw new Error("unable to drop temp table");
    });
  }

  /**
   * Retrieves the changed EC instance from the cache based on the specified key.
   * @param key The key of the instance.
   * @returns The changed EC instance if found, otherwise undefined.
   */
  public get(key: string): ChangedECInstance | undefined {
    return this._db.withPreparedSqliteStatement(`SELECT [value] FROM ${this._cacheTable} WHERE [key]=?`, (stmt) => {
      stmt.bindString(1, key);
      if (stmt.step() === DbResult.BE_SQLITE_ROW) {
        const out = JSON.parse(stmt.getValueString(0), Base64EncodedString.reviver) as ChangedECInstance;
        return out;
      }
      return undefined;
    });
  }

  /**
   * Sets the changed EC instance in the cache with the specified key.
   * @param key The key of the instance.
   * @param value The changed EC instance to be set.
   */
  public set(key: string, value: ChangedECInstance): void {
    const shallowCopy = Object.assign({}, value);
    this._db.withPreparedSqliteStatement(`INSERT INTO ${this._cacheTable} ([key], [value]) VALUES (?, ?) ON CONFLICT ([key]) DO UPDATE SET [value] = [excluded].[value]`, (stmt) => {
      stmt.bindString(1, key);
      stmt.bindString(2, JSON.stringify(shallowCopy, Base64EncodedString.replacer));
      stmt.step();
    });
  }

  /**
   * Returns an iterator for all the changed EC instances in the cache.
   * @returns An iterator for all the changed EC instances.
   */
  public *all(): IterableIterator<ChangedECInstance> {
    const sql = `
      SELECT JSON_GROUP_ARRAY (JSON([value]))
      FROM   (SELECT
                    [value],
                    SUM (LENGTH ([value])) OVER (ORDER BY [key] ROWS UNBOUNDED PRECEDING) / ${this.bufferedReadInstanceSizeInBytes} AS [bucket]
              FROM   ${this._cacheTable})
      GROUP  BY [bucket]`;

    const stmt = this._db.prepareSqliteStatement(sql);
    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      const instanceBucket = JSON.parse(stmt.getValueString(0), Base64EncodedString.reviver) as ChangedECInstance[];
      for (const value of instanceBucket) {
        yield value;
      }
    }
    stmt[Symbol.dispose]();
  }

  /**
   * Returns the number of instances in the cache.
   * @returns The number of instances in the cache.
   */
  public count(): number {
    return this._db.withPreparedSqliteStatement(`SELECT COUNT(*) FROM ${this._cacheTable}`, (stmt) => {
      if (stmt.step() === DbResult.BE_SQLITE_ROW)
        return stmt.getValue(0).getInteger();
      return 0;
    });
  }

  /**
   * Disposes the cache by dropping the temporary table.
   */
  public [Symbol.dispose](): void {
    if (this._db.isOpen) {
      this.dropTempTable();
    }
  }
}


/**
 * Combine partial changed instance into single instance.
 * Partial changes is per table and a single instance can
 * span multiple tables.
 * @beta
 */
export class PartialECChangeUnifier implements Disposable {
  private _readonly = false;
  public constructor(private _db: AnyDb, private _cache: ECChangeUnifierCache = new InMemoryInstanceCache()) { }

  /**
   * Dispose the instance.
   */
  public [Symbol.dispose](): void {
    this._cache[Symbol.dispose]();
  }

  /**
   * Get root class id for a given class
   * @param classId given class id
   * @param db use to find root class
   * @returns return root class id
   */
  private getRootClassId(classId: Id64String): Id64String | undefined {
    const sql = `
      WITH
      [base_class]([classId], [baseClassId], [Level]) AS(
        SELECT [ch].[ClassId], [ch].[BaseClassId], 0
        FROM   [ec_ClassHasBaseClasses] [ch] WHERE  [ch].[ClassId] = ?
        UNION ALL
        SELECT [ch].[ClassId], [ch].[BaseClassId], [Level] + 1
        FROM   [ec_ClassHasBaseClasses] [ch], [base_class] [bc] WHERE  [bc].[BaseClassId] = [ch].[ClassId]

      )
      SELECT FORMAT('0x%x', [bc].[BaseClassId]) rootClass
      FROM   [base_class] [bc]
      WHERE  [bc].[ClassId] <> [bc].[BaseClassId]
              AND [bc].[BaseClassId] NOT IN (SELECT [ca].[ContainerId]
            FROM   [ec_CustomAttribute] [ca]
            WHERE  [ca].[ContainerType] = 30
                      AND [ca].[ClassId] IN (SELECT [cc].[Id]
                    FROM   [ec_Class] [cc]
                          JOIN [ec_Schema] [ss] ON [ss].[Id] = [cc].[SchemaId]
                    WHERE  [cc].[Name] = 'IsMixIn'
                            AND [ss].[Name] = 'CoreCustomAttributes'))
      ORDER BY [Level] DESC`;

    return this._db.withSqliteStatement(sql, (stmt) => {
      stmt.bindId(1, classId);
      if (stmt.step() === DbResult.BE_SQLITE_ROW && !stmt.isValueNull(0)) {
        return stmt.getValueString(0);
      }
      return classId;
    });
  }

  /**
   * Checks if the given `rhsClassId` is an instance of the `lhsClassId`.
   * @param rhsClassId The ID of the right-hand side class.
   * @param lhsClassId The ID of the left-hand side class.
   * @returns `true` if `rhsClassId` is an instance of `lhsClassId`, `false` otherwise.
   */
  private instanceOf(rhsClassId: Id64String, lhsClassId: Id64String): boolean {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return this._db.withPreparedStatement("SELECT ec_instanceof(?,?)", (stmt) => {
      stmt.bindId(1, rhsClassId);
      stmt.bindId(2, lhsClassId);
      stmt.step();
      return stmt.getValue(0).getInteger() === 1;
    });
  }

  /**
   * Combine partial instance with instance with same key if already exists.
   * @param rhs partial instance
   */
  private combine(rhs: ChangedECInstance): void {
    if (!rhs.$meta) {
      throw new Error("PartialECChange being combine must have '$meta' property");
    }
    const key = this.buildKey(rhs);
    const lhs = this._cache.get(key);
    if (lhs) {
      const { $meta: _, ...restOfRhs } = rhs;
      Object.assign(lhs, restOfRhs);
      if (lhs.$meta && rhs.$meta) {
        lhs.$meta.tables = [...rhs.$meta?.tables, ...lhs.$meta?.tables];
        lhs.$meta.changeIndexes = [...rhs.$meta?.changeIndexes, ...lhs.$meta?.changeIndexes];

        // we preserve child class name & id when merging instance.
        if (rhs.$meta.fallbackClassId && lhs.$meta.fallbackClassId && rhs.$meta.fallbackClassId !== lhs.$meta.fallbackClassId) {
          const lhsClassId = lhs.$meta.fallbackClassId;
          const rhsClassId = rhs.$meta.fallbackClassId;
          const isRhsIsSubClassOfLhs = this.instanceOf(rhsClassId, lhsClassId);
          if (isRhsIsSubClassOfLhs) {
            lhs.$meta.fallbackClassId = rhs.$meta.fallbackClassId;
            lhs.$meta.classFullName = rhs.$meta.classFullName;
          }
        }
      }
      this._cache.set(key, lhs);
    } else {
      this._cache.set(key, rhs);
    }
  }

  /**
   * Returns the number of instances in the cache.
   * @returns The number of instances in the cache.
   */
  public getInstanceCount(): number {
    return this._cache.count();
  }

  /**
   * Build key from EC change.
   * @param change EC change
   * @returns key created from EC change.
   */
  private buildKey(change: ChangedECInstance): string {
    let classId = change.ECClassId;
    if (typeof classId === "undefined") {
      if (change.$meta?.fallbackClassId) {
        classId = this.getRootClassId(change.$meta.fallbackClassId);
      }
      if (typeof classId === "undefined") {
        throw new Error(`unable to resolve ECClassId to root class id.`);
      }
    }
    return `${change.ECInstanceId}-${classId}-${change.$meta?.stage}`.toLowerCase();
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
   * Returns complete EC change instances.
   * @beta
   */
  public get instances(): IterableIterator<ChangedECInstance> {
    return this._cache.all();
  }
}

/**
 * Transform sqlite change to ec change. EC change is partial change as
 * it is per table while a single instance can span multiple table.
 * @note PrimitiveArray and StructArray are not supported types.
 * @beta
 *
*/
export class ChangesetECAdaptor implements Disposable {
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
    if (!reader.disableSchemaCheck)
      throw new Error("SqliteChangesetReader, 'disableSchemaCheck' param must be set to false.");

    this._mapCache = new ECDbMap(reader.db);
  }

  /**
   * dispose current instance and it will also dispose the changeset reader.
   */
  public [Symbol.dispose](): void {
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
        const classIdPresentInChange = typeof ecClassId !== "undefined";
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

        if (!classIdPresentInChange && !ecClassId && !fallbackClassId)
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
