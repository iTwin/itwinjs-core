/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

import { BeEvent } from "@bentley/bentleyjs-core";

/** IModel.js UI Event class, which is a subclass of BeEvent with argument type safety.
 * @public
 */
export class UiEvent<TEventArgs> extends BeEvent<(args: TEventArgs) => void> {

  /** Calls BeEvent.raiseEvent with type-safe arguments. */
  public emit(args: TEventArgs): void {
    this.raiseEvent(args);
  }
}
