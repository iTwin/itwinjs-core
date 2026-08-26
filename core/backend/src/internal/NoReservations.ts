/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module iModels
 */

import { SynchronousChannel } from "../SynchronousChannel";
import { _close, _implementationProhibited, _onReservedElementInsert } from "./Symbols";

/** A null-implementation of SynchronousChannel.Reservations for iModels that don't use SchemaSync-backed reservations. */
class NoReservations implements SynchronousChannel.Reservations {
  public readonly [_implementationProhibited] = undefined;
  public get isServerBased() { return false; }
  public [_close](): void { }
  public [_onReservedElementInsert](): void { }
  public needsElementReservation(): boolean { return false; }
  public async reserveElements(): Promise<void> { }
}

export function createNoOpReservations(): SynchronousChannel.Reservations {
  return new NoReservations();
}
