/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp, IpcHandler, NotifyMessageDetails, OutputMessagePriority, Tool } from "@itwin/core-frontend";
import { dtaFrontendChannel, DtaFrontendInfoResult, DtaFrontendIpcInterface } from "../common/DtaFrontendIpcInterface";
import { DtaRpcInterface } from "../common/DtaRpcInterface";

/**
 * Implements [[DtaFrontendIpcInterface]] on the frontend so the backend can invoke it via
 * `IpcHost.makeIpcProxy` / `IpcHost.invoke`. This is the frontend-side half of the backend-to-frontend
 * Ipc invoke demo; see [[InvokeFrontendIpcTool]] for how the round trip is triggered.
 */
class DtaFrontendIpcHandler extends IpcHandler implements DtaFrontendIpcInterface {
  public get channelName() { return dtaFrontendChannel; }

  public async getFrontendInfo(): Promise<DtaFrontendInfoResult> {
    return {
      windowInnerWidth: window.innerWidth,
      windowInnerHeight: window.innerHeight,
      selectedViewportId: IModelApp.viewManager.selectedView?.viewportId,
    };
  }
}

/** Registers the frontend Ipc handler used by the backend-to-frontend Ipc invoke demo. Called once at startup. */
export function registerDtaFrontendIpcHandler(): void {
  DtaFrontendIpcHandler.register();
}

/** Key-in that triggers the backend-to-frontend Ipc invoke demo; see [[DtaRpcInterface.invokeFrontendIpc]]. */
export class InvokeFrontendIpcTool extends Tool {
  public static override toolId = "InvokeFrontendIpc";

  public override async run(): Promise<boolean> {
    const info = await DtaRpcInterface.getClient().invokeFrontendIpc();
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(
      OutputMessagePriority.Info,
      `Backend received via IpcHost.invoke: ${JSON.stringify(info)}`,
    ));

    return true;
  }
}
