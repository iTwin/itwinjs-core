/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  connectViewportFrusta, connectViewportViews, IModelApp, Tool, Viewport,
} from "@itwin/core-frontend";

class State {
  private readonly _viewportIds: number[];

  constructor(viewports: Viewport[], public readonly disconnect: () => void) {
    this._viewportIds = viewports.map((x) => x.viewportId).sort();
  }

  public equals(viewports: Viewport[]) {
    if (viewports.length !== this._viewportIds.length)
      return false;

    const ids = viewports.map((x) => x.viewportId).sort();
    return ids.every((val, idx) => val === this._viewportIds[idx]);
  }
}

/** Connect or disconnect two or more viewports using connectViewports. */
export class SyncViewportsTool extends Tool {
  public static override toolId = "SyncViewports";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return undefined; }

  protected get syncType(): "frustum" | "view" { return "view"; }

  private static _state?: State;
  private static _removeListeners?: VoidFunction;

  public override async run(vps?: Viewport[]): Promise<boolean> {
    const that = SyncViewportsTool;
    if (!vps || vps.length < 2) {
      that.disconnect();
    } else {
      if (that._state && that._state.equals(vps))
        that.disconnect();
      else
        that.connect(vps, this.syncType);
    }

    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    if (args.length === 0)
      return this.run();

    const allVps = Array.from(IModelApp.viewManager);
    if (args.length === 1)
      return args[0].toLowerCase() === "all" ? this.run(allVps) : false;

    const vps: Viewport[] = [];
    for (const arg of args) {
      const vpId = Number.parseInt(arg, 10);
      if (Number.isNaN(vpId))
        return false;

      const vp = allVps.find((x) => x.viewportId === vpId);
      if (!vp)
        return false;

      vps.push(vp);
    }

    return this.run(vps);
  }

  private static connect(vps: Viewport[], syncType: "view" | "frustum"): void {
    this.disconnect();
    const connect = "view" === syncType ? connectViewportViews : connectViewportFrusta;
    this._state = new State(vps, connect(vps));
    const dispose = vps.map((x) => x.onDisposed.addOnce(() => this.disconnect()));
    this._removeListeners = () => dispose.forEach((x) => x());
  }

  private static disconnect(): void {
    this._state?.disconnect();
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

  protected override get syncType() { return "frustum" as const; }
}
