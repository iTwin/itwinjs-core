/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

// Keep this consistent with BeSQLite.h Db::OpenMode
export namespace BeSQLite {
   export enum OpenMode {
    Readonly = 0x00000001,
    ReadWrite = 0x00000002,
  }

// Keep this consistent with BeSQLite.h DbResult
   export enum DbResult {
    BE_SQLITE_OK = 0,
    BE_SQLITE_ERROR = 1,
    BE_SQLITE_ROW = 100,
    BE_SQLITE_DONE = 101,
    // *** TBD: Many more
  }

}
