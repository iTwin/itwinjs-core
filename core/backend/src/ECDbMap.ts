/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECDb
 */
import { DbResult, Id64String } from "@itwin/core-bentley";
import { AnyDb } from "./SqliteChangesetReader";

/** @internal */
export interface IClassRef {
  classId: Id64String;
  classFullName: string;
}

/** @internal */
export interface IClassMap {
  readonly id: Id64String;
  readonly name: string;
  readonly mapStrategy: "NotMapped" | "OwnTable" | "TablePerHierarchy" | "ExistingTable" | "ForeignKeyInTargetTable" | "ForeignKeyInSourceTable";
  readonly type: "Entity" | "Relationship" | "Struct" | "CustomAttribute";
  readonly modifier: "None" | "Abstract" | "Sealed";
  readonly properties: IProperty[];
}

/** @internal */
export interface IDateTimeInfo {
  readonly dateTimeKind?: "Utc" | "Local" | "Unspecified";
  readonly dateTimeComponent?: "DateTime" | "Date" | "TimeOfDay";
}

/** @internal */
export interface IProperty {
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

/** @internal */
export interface IColumn {
  readonly table: string;
  readonly column: string;
  readonly type: "Any" | "Boolean" | "Blob" | "Timestamp" | "Real" | "Integer" | "Text";
  readonly columnKind: "Default" | "Id" | "ClassId" | "Shared";
  readonly accessString: string;
  readonly isVirtual: boolean;
}

/** @internal */
export interface ITable {
  readonly id: Id64String;
  readonly name: string;
  readonly type: "Primary" | "Joined" | "Existing" | "Overflow" | "Virtual";
  readonly exclusiveRootClassId: Id64String;
  readonly isClassIdVirtual: boolean;
}

/** @internal */
export class ECDbMap {
  protected _cachedClassMaps = new Map<Id64String, IClassMap>();
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
 * Returns only class-level metadata with an empty properties array.
 * Use when instance identity is needed without property details.
 * @internal
 */
export class ECDbInstanceKeyMap extends ECDbMap {
  public override getClassMap(classId: Id64String): IClassMap | undefined {
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
                pm.ClassId = cs.Id AND pt.Name = 'ECInstanceId'
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
        const classMap = JSON.parse(stmt.getValueString(0)) as IClassMap;
        this._cachedClassMaps.set(classId, classMap);
        return classMap;
      }
      return undefined;
    });
  }
}

/**
 * Returns class metadata with full property type information but without SQLite column-mapping details.
 * Use for schema-level consumers that do not need storage details.
 * @internal
 */
export class ECDbBisPropertyMap extends ECDbMap {
  private readonly _bisCoreCClassId: string;
  public constructor(db: AnyDb) {
    super(db);
    this._bisCoreCClassId = this.getBisCoreElementClassId();
  }

  private isDerivedClassOfBisCore(classId: string | undefined): boolean {
    if (!classId) return false;
    const sql = `
      WITH RECURSIVE [ancestry]([classId], [baseClassId]) AS (
        SELECT [ClassId], [BaseClassId]
        FROM   [ec_cache_ClassHierarchy]
        WHERE  [ClassId] = ?
        UNION
        SELECT [h].[ClassId], [h].[BaseClassId]
        FROM   [ec_cache_ClassHierarchy] [h]
               JOIN [ancestry] [a] ON [h].[ClassId] = [a].[baseClassId]
      )
      SELECT EXISTS (
        SELECT 1 FROM [ancestry] WHERE [baseClassId] = ?
      )
    `;
    return this.db.withPreparedSqliteStatement(sql, (stmt) => {
      stmt.bindId(1, classId);
      stmt.bindId(2, this._bisCoreCClassId);
      if (stmt.step() === DbResult.BE_SQLITE_ROW)
        return stmt.getValue(0).getInteger() === 1;
      return false;
    });
  }

  private getBisCoreElementClassId(): string {
    const sql = `
      SELECT format('0x%x', cs.Id)
      FROM   [ec_Class] [cs]
            JOIN [ec_Schema] [sc] ON [sc].[Id] = [cs].[SchemaId]
      WHERE  ([sc].[Name] = 'BisCore'
              AND [cs].[Name] = 'Element')
    `;
    return this.db.withPreparedSqliteStatement(sql, (stmt) => {
      let classId = "";
      while (stmt.step() === DbResult.BE_SQLITE_ROW)
        classId = stmt.getValueString(0);
      return classId;
    });
  }

  public override getClassMap(classId: Id64String): IClassMap | undefined {
    if (this._cachedClassMaps.has(classId))
      return this._cachedClassMaps.get(classId);

    if (!this.isDerivedClassOfBisCore(classId))
      return super.getClassMap(classId);

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
                (pm.ClassId = cs.Id AND (pt.Name = 'ECInstanceId' OR pt.Name = 'ECClassId'))
                OR
                (pm.ClassId = :bisCoreElementClassId AND (pt.Name != 'ECInstanceId' AND pt.Name != 'ECClassId'))
              GROUP BY
                pt.Id
            )
        )
      ) classDef
    FROM [ec_Class] [cs]
      JOIN [ec_ClassMap] [cm] ON [cm].[ClassId] = [cs].[Id]
      JOIN [ec_Schema] [ss] ON [ss].[Id] = [cs].[SchemaId]
    WHERE
      [cs].[Id] = :derivedClassId
    `;

    return this.db.withPreparedSqliteStatement(sql, (stmt) => {
      stmt.bindId(":derivedClassId", classId);
      stmt.bindId(":bisCoreElementClassId", this._bisCoreCClassId);
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

