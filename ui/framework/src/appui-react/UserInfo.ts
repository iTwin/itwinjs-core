/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module State
 */

/** Information on the authenticated user.
 * @public
 */
export class UserInfo {
  constructor(
    /** Id of the user */
    public id: string,

    /** Email details */
    public email?: { id: string, isVerified?: boolean },

    /** Profile of the user */
    public profile?: { firstName: string, lastName: string, name?: string, preferredUserName?: string },

    /** Organization the user belongs to */
    public organization?: { id: string, name: string },

    /** Feature tracking information associated with the user */
    public featureTracking?: { ultimateSite: string, usageCountryIso: string },
  ) { }
}
