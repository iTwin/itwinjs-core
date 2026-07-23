/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module iModels
 */

import { SharedDefinitionReservations } from "../SharedDefinitionReservations";
import { _close, _implementationProhibited, _onDefinitionElementInsert } from "./Symbols";

/** A null-implementation of SharedDefinitionReservations for iModels that don't use SchemaSync-backed reservations. */
class NoReservations implements SharedDefinitionReservations {
  public readonly [_implementationProhibited] = undefined;
  public get isServerBased() { return false; }
  public [_close](): void { }
  public [_onDefinitionElementInsert](): void { }
  public needsDefinitionReservation(): boolean { return false; }
  public async reserveDefinitionElements(): Promise<void> { }
}

export function createNoOpReservations(): SharedDefinitionReservations {
  return new NoReservations();
}
