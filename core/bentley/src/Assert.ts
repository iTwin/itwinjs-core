/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utils */

// @todo Needs to be commented out in a production environment.
/**
 * Assert by throwing a programmer error
 */
export function assert(condition: boolean, msg?: string): void {
  if (!condition)
    throw new Error("Assert: " + ((msg !== undefined) ? msg : "Programmer Error"));
}
