
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** Profile of the authenticated user. */
export class UserProfile {
  constructor(
    public firstName: string,
    public lastName: string,
    public email: string,
    public userId: string,
    public organization: string,
  ) { }

}
