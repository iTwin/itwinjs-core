/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** getParentSelector
 * @internal
 */
export const getParentSelector = (): HTMLElement => {
  let portal = document.querySelector("#portal");
  if (!portal) {
    portal = document.createElement("div");
    portal.id = "portal";
    document.body.appendChild(portal);
  }
  return portal as HTMLElement;
};
