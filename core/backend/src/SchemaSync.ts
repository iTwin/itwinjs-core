/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module SQLiteDb
 */

import { CloudSqlite } from "./CloudSqlite";
import { VersionedSqliteDb } from "./SQLiteDb";

/** @beta */
export namespace SchemaSync {

  /**
   * A SQLite database for storing schemas.
   */
  export class SchemaSyncDb extends VersionedSqliteDb {
    public override readonly myVersion = "4.0.0";
    protected override createDDL() { }
  }

  const defaultDbName = "SchemaSyncDb" as const;

  /**
   * Provides access to a cloud-based `SchemaSyncDb` to hold ECSchemas.
   */
  export class CloudAccess extends CloudSqlite.DbAccess<SchemaSyncDb> {
    public constructor(props: CloudSqlite.ContainerAccessProps) {
      super({ dbType: SchemaSyncDb, props, dbName: defaultDbName });
    }

    /** @internal */
    public getUri() {
      return `${this.getCloudDb().nativeDb.getFilePath()}?vfs=${this.container.cache?.name}&writable=${this.container.isWriteable ? 1 : 0}`;
    }
    /**
     * Initialize a cloud container for use as a SchemaSync. The container must first be created via its storage supplier api (e.g. Azure, or AWS).
     * A valid sasToken that grants write access must be supplied. This function creates and uploads an empty ChannelDb into the container.
     * @note this deletes any existing content in the container.
     */
    public static async initializeDb(props: CloudSqlite.ContainerAccessProps) {
      return super._initializeDb({ props, dbType: SchemaSyncDb, dbName: defaultDbName });
    }
  }
}

