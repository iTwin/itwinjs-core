/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module SQLiteDb
 */

import { BentleyError, DbResult } from "@itwin/core-bentley";
import { CloudSqlite } from "./CloudSqlite";
import { VersionedSqliteDb } from "./SQLiteDb";
import { IModelTestUtils } from "./test";
import { StandaloneDb } from "./IModelDb";

/** @beta */
export namespace SharedSchemaChannel {
  /**
   * A SQLite database for storing schema changes.
   */
  export class SyncDB extends VersionedSqliteDb {
    public override readonly myVersion = "3.0.0";
    // public override readonly nativeDb = new IModelHost.platform.DgnDb();

    protected override createDDL() {
      // these are required for local cache to be able to init sharedChannel
      this.createTable({ tableName: "ec_Schema", columns: "Id INTEGER PRIMARY KEY,Name TEXT UNIQUE NOT NULL COLLATE NOCASE,DisplayLabel TEXT,Description TEXT,Alias TEXT UNIQUE NOT NULL COLLATE NOCASE,VersionDigit1 INTEGER NOT NULL,VersionDigit2 INTEGER NOT NULL,VersionDigit3 INTEGER NOT NULL,OriginalECXmlVersionMajor INTEGER,OriginalECXmlVersionMinor INTEGER" });
      this.createTable({ tableName: "ec_Class", columns: "Id INTEGER PRIMARY KEY,SchemaId INTEGER NOT NULL REFERENCES ec_Schema(Id) ON DELETE CASCADE,Name TEXT NOT NULL COLLATE NOCASE,DisplayLabel TEXT,Description TEXT,Type INTEGER NOT NULL,Modifier INTEGER NOT NULL,RelationshipStrength INTEGER,RelationshipStrengthDirection INTEGER,CustomAttributeContainerType INTEGER" });
      this.createTable({ tableName: "ec_Table", columns: "Id INTEGER PRIMARY KEY,ParentTableId INTEGER REFERENCES ec_Table(Id) ON DELETE CASCADE,Name TEXT UNIQUE NOT NULL COLLATE NOCASE,Type INTEGER NOT NULL,ExclusiveRootClassId INTEGER REFERENCES ec_Class(Id) ON DELETE SET NULL,UpdatableViewName TEXT" });

      // these are just for testing
      this.createTable({ tableName: "ec_Enumeration", columns: "Id INTEGER PRIMARY KEY,SchemaId INTEGER NOT NULL REFERENCES ec_Schema(Id) ON DELETE CASCADE,Name TEXT NOT NULL COLLATE NOCASE,DisplayLabel TEXT,Description TEXT,UnderlyingPrimitiveType INTEGER NOT NULL,IsStrict BOOLEAN NOT NULL CHECK(IsStrict IN (0,1)),EnumValues TEXT NOT NULL" });
      this.createTable({ tableName: "ec_KindOfQuantity", columns: "Id INTEGER PRIMARY KEY,SchemaId INTEGER NOT NULL REFERENCES ec_Schema(Id) ON DELETE CASCADE,Name TEXT NOT NULL COLLATE NOCASE,DisplayLabel TEXT,Description TEXT,PersistenceUnit TEXT NOT NULL,RelativeError REAL NOT NULL,PresentationUnits TEXT" });
      this.createTable({ tableName: "ec_PropertyCategory", columns: "Id INTEGER PRIMARY KEY,SchemaId INTEGER NOT NULL REFERENCES ec_Schema(Id) ON DELETE CASCADE,Name TEXT NOT NULL COLLATE NOCASE,DisplayLabel TEXT,Description TEXT,Priority INTEGER" });
      this.createTable({ tableName: "ec_Property", columns: "Id INTEGER PRIMARY KEY,ClassId INTEGER NOT NULL REFERENCES ec_Class(Id) ON DELETE CASCADE,Name TEXT NOT NULL COLLATE NOCASE,DisplayLabel TEXT,Description TEXT,IsReadonly BOOLEAN NOT NULL CHECK (IsReadonly IN (0,1)),Priority INTEGER,Ordinal INTEGER NOT NULL,Kind INTEGER NOT NULL,PrimitiveType INTEGER,PrimitiveTypeMinLength INTEGER,PrimitiveTypeMaxLength INTEGER,PrimitiveTypeMinValue NUMERIC,PrimitiveTypeMaxValue NUMERIC,EnumerationId INTEGER REFERENCES ec_Enumeration(Id) ON DELETE CASCADE,StructClassId INTEGER REFERENCES ec_Class(Id) ON DELETE CASCADE,ExtendedTypeName TEXT,KindOfQuantityId INTEGER REFERENCES ec_KindOfQuantity(Id) ON DELETE CASCADE,CategoryId INTEGER REFERENCES ec_PropertyCategory(Id) ON DELETE CASCADE,ArrayMinOccurs INTEGER,ArrayMaxOccurs INTEGER,NavigationRelationshipClassId INTEGER REFERENCES ec_Class(Id) ON DELETE CASCADE,NavigationDirection INTEGER" });
      // Seems like these cause the db files in the cloud to be malformed
    }

    public async createBriefcaseAsync(name: string, channelUri: string): Promise<StandaloneDb> {
      const props = {
        rootSubject: { name, },
        allowEdit: `{ "txns": true }`,
      };
      const filename = IModelTestUtils.prepareOutputFile("ShareChannel_Briefcases", `${name}.bim`);
      const briefcase = StandaloneDb.createEmpty(filename, props);
      briefcase.nativeDb.sharedChannelInit(channelUri);
      return briefcase;
    }

    public createBriefcase(name: string, channelUri: string): StandaloneDb {
      // const sharedChannelUri = path.join(this.nativeDb.getFilePath());
      // this.createSharedChannel(sharedChannelUri);
      const props = {
        rootSubject: { name, },
        allowEdit: `{ "txns": true }`,
      };
      const filename = IModelTestUtils.prepareOutputFile("ShareChannel_Briefcases", `${name}.bim`);
      const briefcase = StandaloneDb.createEmpty(filename, props);
      briefcase.nativeDb.sharedChannelInit(channelUri);
      return briefcase;
    }

    public getTables(): string[] {
      const results: string[] = [];
      this.withSqliteStatement("select sql from sqlite_master where type='table' and name like 'ec\\_%' escape '\\' order by name", (stmt) => {
        while (stmt.step() == DbResult.BE_SQLITE_ROW) {
          results.push(stmt.getValueString(0));
        }
      });
      return results;
    }

    public async createUnlinkedBriefcaseAsync(name: string): Promise<StandaloneDb> {
      const props = {
        rootSubject: { name, },
        allowEdit: `{ "txns": true }`,
      };
      const filename = IModelTestUtils.prepareOutputFile("ShareChannel_Briefcases", `${name}.bim`);
      const briefcase = StandaloneDb.createEmpty(filename, props);
      return briefcase;
    }

    public async addProperty(name: string): Promise<void> {
      // this.withSqliteStatement("INSERT OR REPLACE INTO ec_Property(ClassId,Name) VALUES (?,?)", (stmt) => {
      this.withSqliteStatement("INSERT OR REPLACE INTO ec_Schema(Name,Alias,VersionDigit1,VersionDigit2,VersionDigit3) VALUES (?,?,?,?,?)", (stmt) => {
        // stmt.bindInteger(1, 0);
        // stmt.bindInteger(1, 294);
        // stmt.bindString(2, name);
        stmt.bindString(1, name);
        stmt.bindString(2, "tc_");
        stmt.bindDouble(3, 1);
        stmt.bindDouble(4, 1);
        stmt.bindDouble(5, 1);

        const rc = stmt.step();
        if (rc !== DbResult.BE_SQLITE_DONE)
          throw new BentleyError(rc, "error saving property");
      });
    }
  }

  const defaultDbName = "SyncDB" as const;

  /**
   * Provides access to a cloud-based `PropertyDb` to hold a set of values of type `PropertyType`, each with a unique `PropertyName`.
   * `PropertyStore.PropertyDb`s that are stored in cloud containers require an access token that grants permission to read and/or write them.
   * All write operations will fail without an access token that grants write permission.
   *
   * The database is cached on a local drive so reads are fast and inexpensive, and may even be done offline after a prefetch.
   * However, that means that callers are responsible for synchronizing the local cache to ensure it includes changes
   * made by others, as appropriate (see [[synchronizeWithCloud]]).
   */
  export class CloudAccess extends CloudSqlite.DbAccess<SyncDB> {
    public constructor(props: CloudSqlite.ContainerAccessProps) {
      super({ dbType: SyncDB, props, dbName: defaultDbName });
    }

    /**
     * Initialize a cloud container for use as a PropertyStore. The container must first be created via its storage supplier api (e.g. Azure, or AWS).
     * A valid sasToken that grants write access must be supplied. This function creates and uploads an empty PropertyDb into the container.
     * @note this deletes any existing content in the container.
     */
    public static async initializeDb(args: { props: CloudSqlite.ContainerAccessProps, initContainer?: { blockSize?: number } }) {
      return super._initializeDb({ ...args, dbType: SyncDB, dbName: defaultDbName });
    }
  }
}
