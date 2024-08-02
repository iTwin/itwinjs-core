/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Tool } from "@itwin/core-frontend";
import { attachGeoscienceTileset } from "@itwin/frontend-tiles";

/** This tool adds a seequent reality model to the viewport.
 * @alpha
 */
export class AddSeequentRealityModel extends Tool {
  public static override toolId = "AddSeequentRealityModel";
  public static override get minArgs() { return 5; }
  public static override get maxArgs() { return 5; }

  /** This method runs the tool, adding a reality model to the viewport
   * @param url the URL which points to the reality model tileset
   */
  public override async run(endpointUrl: string, organizationId: string, workspaceId: string, geoscienceObjectId: string, accessToken: string): Promise<boolean> {

    const args = {
      endpointUrl,
      accessToken,
      organizationId,
      workspaceId,
      geoscienceObjectId,
    };

    await attachGeoscienceTileset(args);
    return true;
  }

  /** Executes this tool's run method with args[0] containing the `url` argument.
   * @see [[run]]
   */
  public override async parseAndRun(...args: string[]): Promise<boolean> {
    return this.run(args[0], args[1], args[2], args[3], args[4]);
  }
}
