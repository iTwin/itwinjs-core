/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp, Tool, TwoWayViewportFrustumSync, TwoWayViewportSync, Viewport } from "@itwin/core-frontend";

class State {
  constructor(public vp1: Viewport, public vp2: Viewport, public sync: TwoWayViewportSync) { }
}

/** Connect or disconnect two viewports using TwoWayViewportSync. */
export class SyncViewportsTool extends Tool {
  public static override toolId = "SyncViewports";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 2; }

  protected get syncType(): typeof TwoWayViewportSync { return TwoWayViewportSync; }

  private static _state?: State;
  private static _removeListeners?: VoidFunction;

  public override async run(vp1?: Viewport, vp2?: Viewport): Promise<boolean> {
    const that = SyncViewportsTool;
    if (!vp1 && !vp2) {
      that.disconnect();
    } else if (vp1 && vp2 && vp1 !== vp2) {
      if (that._state && that._state.vp1 === vp1 && that._state.vp2 === vp2)
        that.disconnect();
      else
        that.connect(vp1, vp2, this.syncType);
    }

    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    switch (args.length) {
      case 0:
        return this.run();
      case 2:
        const vpId1 = Number.parseInt(args[0], 10);
        const vpId2 = Number.parseInt(args[1], 10);
        if (Number.isNaN(vpId1) || Number.isNaN(vpId2) || vpId1 === vpId2)
          return true;

        let vp1, vp2;
        for (const vp of IModelApp.viewManager) {
          if (vp.viewportId === vpId1)
            vp1 = vp;
          else if (vp.viewportId === vpId2)
            vp2 = vp;
        }

        if (vp1 && vp2)
          return this.run(vp1, vp2);
    }

    return true;
  }

  private static connect(vp1: Viewport, vp2: Viewport, type: typeof TwoWayViewportSync): void {
    this.disconnect();
    this._state = new State(vp1, vp2, new type());
    this._state.sync.connect(vp1, vp2);
    const dispose1 = vp1.onDisposed.addOnce(() => this.disconnect());
    const dispose2 = vp2.onDisposed.addOnce(() => this.disconnect());
    this._removeListeners = () => { dispose1(); dispose2(); };
  }

  private static disconnect(): void {
    this._state?.sync.disconnect();
    this._state = undefined;

    if (this._removeListeners) {
      this._removeListeners();
      this._removeListeners = undefined;
    }
  }
}

/** Connect or disconnect two viewports using TwoWayViewportFrustumSync. */
export class SyncViewportFrustaTool extends SyncViewportsTool {
  public static override toolId = "SyncFrusta";

  protected override get syncType() { return TwoWayViewportFrustumSync; }
}
