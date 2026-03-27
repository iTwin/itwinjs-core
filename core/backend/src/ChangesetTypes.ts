/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SQLiteDb
 */
import { ECDb } from "./ECDb";
import { IModelDb } from "./IModelDb";

/** Db from which schema will be read. It should be from timeline to which changeset belong.
 * @beta
 */
export type AnyDb = IModelDb | ECDb;

/** Operation that caused the change.
 * @beta
 */
export type SqliteChangeOp = "Inserted" | "Updated" | "Deleted";

/** Stage is version of value that needed to be read.
 * @beta
 */
export type SqliteValueStage = "Old" | "New";
