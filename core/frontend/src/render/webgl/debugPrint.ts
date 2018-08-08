/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

/** This function is intended to be used only when explicit debugging options are enabled;
 * never in production builds. Avoids having to duplicate the tslint:disable-line all over the place.
 * @hidden
 */
export function debugPrint(str: string): void {
  console.log(str); // tslint:disable-line:no-console
}
