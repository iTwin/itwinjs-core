/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Tools */

import {
  IModelApp,
  MessageBoxIconType,
  MessageBoxType,
  Tool,
} from "@bentley/imodeljs-frontend";

/** Queries the client's level of compatibility with the rendering system and outputs it to NotificationManager.
 * @beta
 */
export class ReportWebGLCompatibilityTool extends Tool {
  public static toolId = "ReportWebGLCompatibility";
  public run(_args: any[]): boolean {
    const info = IModelApp.queryRenderCompatibility();
    const statuses = ["OK", "Missing Optional Features", "Major Performance Caveat", "Missing Required Features", "Failed to Create Context"];
    const status = info.status < statuses.length ? statuses[info.status] : "UNKNOWN";
    const json = JSON.stringify(info, null, 2); // prettify JSON output

    const msg = "Compatibility: " + status + "\n" + json;
    const html = document.createElement("div");
    html.style.whiteSpace = "pre-wrap";
    html.appendChild(document.createTextNode(msg));

    IModelApp.notifications.openMessageBox(MessageBoxType.Ok, html, MessageBoxIconType.Information); // tslint:disable-line:no-floating-promises
    return true;
  }
}
