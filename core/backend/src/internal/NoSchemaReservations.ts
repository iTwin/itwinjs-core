/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { SharedSchemaReservations } from "../SharedSchemaReservations";
import { _close } from "./Symbols";

/** A null-implementation of [[SharedSchemaReservations]] for iModels that don't use SchemaSync-backed reservations. */
class NoSchemaReservations implements SharedSchemaReservations {
  public get isServerBased() { return false; }
  public [_close](): void { }
  public async reserveSchemaImport(): Promise<void> { }
}

/** @internal */
export function createNoOpSchemaReservations(): SharedSchemaReservations {
  return new NoSchemaReservations();
}
