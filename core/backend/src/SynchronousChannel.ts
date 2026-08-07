/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { GuidString } from "@itwin/core-bentley";
import { CodeProps } from "@itwin/core-common";
import { _close, _implementationProhibited, _onReservedElementInsert } from "./internal/Symbols";
import { OnElementPropsArg } from "./Element";

/** Types used by the synchronous coordination channels that help multiple briefcases avoid conflicts
 * before they appear in the asynchronous changeset timeline.
 * @beta
 */
export namespace SynchronousChannel {
  /** Arguments for [[SynchronousChannel.Reservations.reserveElements]].
   * @beta
   */
  export interface ReserveElementsArgs {
    /** The elements to reserve. The whole batch succeeds or fails together. */
    elements: Iterable<{
      /** The federationGuid that stably identifies this element across briefcases. Reservations always require an explicit federationGuid. */
      federationGuid: GuidString;
      classFullName: string;
      /** The Code for this element. When a non-empty [[Code.value]] is supplied, it must be unique across all reservations. Defaults to an empty Code. */
      code?: CodeProps;
    }>;
  }

  /**
   * Interface used to ***reserve*** elements with shared identities as part of [coordinating simultaneous edits]($docs/learning/backend/ConcurrencyControl.md) from multiple briefcases.
   * Unlike **locks** (via [[LockControl]]), which block users from making conflicting changes to existing elements, **reservations** can be used to communicate "in-flight"
   * changes between briefcases, allowing users to concurrently add and use identical dependencies (e.g., component definitions, schemas, etc.) without introducing conflicts.
   * @see [[IModelDb.reservations]] to access the reservations for an iModel.
   * @beta
   */
  export interface Reservations {
    /** @internal*/
    readonly [_implementationProhibited]: unknown;

    /** @internal true if this Reservations uses a server-based concurrency approach. */
    readonly isServerBased: boolean;

    /**
     * Close the local reservation database
     * @internal
     */
    [_close]: () => void;

    /**
     * Notification that a new element with an explicitly-set federationGuid is being inserted. Called by [[Element.onInsert]]
     * @internal
     */
    [_onReservedElementInsert]: (arg: OnElementPropsArg) => void;

    /**
     * Determine whether an ID has already been reserved for a future element with the given federationGuid.
     * @note Due to local caching, a return value of `false` cannot be taken as a guarantee that no other briefcase has already reserved the same
     * element, only that a reservation for the element with the given federationGuid was seen as of the last call to [[reserveElements]].
     * @throws [ElementReservationError]($common) if the federationGuid is not a valid GUID.
     */
    needsElementReservation(federationGuid: GuidString): boolean;

    /**
     * Acquire reservations for one or more elements from the reservation service, if required and not already reserved by another user.
     * @throws Error if the requested elements are inconsistent with existing reservations, or if any other error occurs while updating the reservations.
     */
    reserveElements(args: ReserveElementsArgs): Promise<void>;
  }

}
