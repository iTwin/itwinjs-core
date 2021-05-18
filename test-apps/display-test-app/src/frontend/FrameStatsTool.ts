/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { FrameStats, IModelApp, Tool } from "@bentley/imodeljs-frontend";

/** Enable or disable (toggle) frame statistics reporting for all viewports. */
export class FrameStatsTool extends Tool {
  public static toolId = "FrameStats";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 0; }

  public run(): boolean {
    for (const vp of IModelApp.viewManager) {
      if (vp.onFrameStats.numberOfListeners > 0)
        vp.onFrameStats.clear();
      else
        vp.onFrameStats.addListener((stats: Readonly<FrameStats>) => {
          console.log(`frame stats (vp=${  vp.viewportId  }) = ${ JSON.stringify(stats)}`); // eslint-disable-line no-console
        });
    }
    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    switch (args.length) {
      case 0:
        return this.run();
    }
    return true;
  }
}
