/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp, Tool, Viewport } from "@itwin/core-frontend";
import { Surface } from "./Surface";
import { Window } from "./Window";

class RealityModelSettings extends Window {
  public readonly windowId: string;
  private readonly _viewport: Viewport;
  private readonly _dispose: () => void;

  public constructor(viewport: Viewport) {
    super(Surface.instance, { top: 0, left: 50 });
    this._viewport = viewport;
    this.windowId = `realityModelSettings-${viewport.viewportId}`;
    this.isPinned = true;
    this.title = "Reality Model Display Settings";

    this.contentDiv.innerText = "hello there can anyone hear me???";

    const removals = [
      viewport.onChangeView.addOnce(() => this.close()),
      viewport.onDisposed.addOnce(() => this.close()),
    ];

    this._dispose = () => removals.forEach((removal) => removal());
  }

  private close(): void {
    this.surface.close(this);
  }

  public override onClosed(): void {
    this._dispose();
  }
}

export class OpenRealityModelSettingsTool extends Tool {
  public static override toolId = "OpenRealityModelSettings";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 1; }

  public override async run(): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp)
      return false;

    // ###TODO find reality model
    //  ###TODO Check if already open...
    const win = new RealityModelSettings(vp);
    win.surface.addWindow(win);
    win.surface.element.appendChild(win.container);

    return true;
  }
}
