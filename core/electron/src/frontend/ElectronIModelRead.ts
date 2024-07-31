import { IModelConnectionProps } from "@itwin/core-common";
import { IModelAccessProps, IModelOpenProps, IModelRead, IpcApp } from "@itwin/core-frontend";

/** IModelRead frontend implementation reliant on current iTwin.js IPC. */
export class IpcIModelRead implements IModelRead {
  private _ipc: IModelRead = IpcApp.makeIpcProxy<IModelRead>("iModelRead");

  public async getConnectionProps(props: IModelOpenProps): Promise<IModelConnectionProps> {
    return this._ipc.getConnectionProps(props);
  }

  public async getToolTipMessage(iModelAccessProps: IModelAccessProps, elementId: string): Promise<string[]> {
    return this._ipc.getToolTipMessage(iModelAccessProps, elementId);
  }
}

/** IModelRead frontend implementation calling Electron IPC directly (requires current preload script). */
export class ElectronIModelRead implements IModelRead {
  public async getConnectionProps(props: IModelOpenProps): Promise<IModelConnectionProps> {
    return window.itwinjs.invoke("itwin.iModelRead.getConnectionProps", props);
  }

  public async getToolTipMessage(iModelAccessProps: IModelAccessProps, elementId: string): Promise<string[]> {
    return window.itwinjs.invoke("itwin.iModelRead.getToolTipMessage", iModelAccessProps, elementId);
  }
}
