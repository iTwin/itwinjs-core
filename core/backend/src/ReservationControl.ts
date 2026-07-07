/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { GuidString } from "@itwin/core-bentley";
import { _close, _implementationProhibited, _onDefinitionElementInsert } from "./internal/Symbols";
import { ElementProps } from "@itwin/core-common";
import { OnElementPropsArg } from "./Element";

/** Identifies a [[DefinitionElement]] to be pre-reserved by [[reserveDefinitionElements]].
 * @beta
 */
export type PartialDefinitionElementProps = Pick<ElementProps, "federationGuid" | "classFullName" | "code">;

/** Arguments for [[reserveDefinitionElements]].
 * @beta
 */
export interface ReserveDefinitionElementsArgs {
  /** The DefinitionElements to reserve. The whole batch succeeds or fails together. */
  elements: PartialDefinitionElementProps[];
}

/**
 * Interface used to ***reserve*** shared definitions as part of [coordinating simultaneous edits]($docs/learning/backend/ConcurrencyControl.md) from multiple briefcases.
 * Unlike **locks** (via [[LockControl]]), which block users from making conflicting changes to existing elements, **reservations** can be used to communicate "in-flight"
 * changes between briefcases, allowing users to concurrently add and use identical dependencies (e.g., component definitions, schemas, etc.) without introducing conflicts.
 * @see [[IModelDb.locks]] to access the locks for an iModel.
 * @beta
 */
export interface ReservationControl {
  /** @internal*/
  readonly [_implementationProhibited]: unknown;

  /** @internal true if this ReservationControl uses a server-based concurrency approach. */
  readonly isServerBased: boolean;

  /**
   * Close the local reservation database
   * @internal
   */
  [_close]: () => void;

  /**
   * Notification that a new definition element is being inserted. Called by [[DefinitionElement.onInsert]]
   * @internal
   */
  [_onDefinitionElementInsert]: (id: OnElementPropsArg) => void;

  /**
   * Determine whether an ID has already been reserved for a future definition element with the given federationGuid.
   * @note Due to local caching, a return value of `true` cannot be taken as a guarantee that no other briefcase has already reserved the same
   * definition, only that no reservation for the definition with the given federationGuid was seen as of the last call to [[reserveDefinitionElements]].
   */
  needsDefinitionReservation(federationGuid: GuidString): boolean;

  /**
   * Acquire reservations for one or more elements from the reservation service, if required and not already reserved by another user.
   * @throws Error if the requested definitions are inconsistent with existing reservations, or if any other error occurs while updating the reservations.
   */
  reserveDefinitionElements(args: ReserveDefinitionElementsArgs): Promise<void>;
}
