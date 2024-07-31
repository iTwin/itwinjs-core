import { CheckpointManager, CheckpointProps, IModelDb, IModelHost, IpcHandler, SnapshotDb, V1CheckpointManager } from "@itwin/core-backend";
import { ElectronHost } from "./ElectronHost";
import { IModelConnectionProps } from "@itwin/core-common";
import { IModelAccessProps, IModelOpenProps } from "@itwin/core-frontend"; // TEMPORARY. These types should be to core-common.

/** IModelRead backend implementation reliant on current iTwin.js IPC. */
export class IModelReadIpcHandler extends IpcHandler {
  public get channelName() {
    return "iModelRead";
  }

  public async getConnectionProps(props: IModelOpenProps): Promise<IModelConnectionProps> {
    return getConnectionProps(props);
  }

  public async getToolTipMessage(iModelAccessProps: IModelAccessProps, elementId: string): Promise<string[]> {
    const iModelDb = SnapshotDb.tryFindByKey(CheckpointManager.getKey({ ...iModelAccessProps, iTwinId: "" })); // Because our types are 100% accurate, iTwinId is mandatory, but is unused.
    if (!iModelDb)
      throw new Error("iModel not found");

    return iModelDb.elements.getElement(elementId).getToolTipMessage();
  }
}

/** IModelRead backend implementation calling Electron IPC directly. */
export class IModelReadElectronHandler {
  constructor() {
    ElectronHost.ipcMain.handle("itwin.iModelRead.getConnectionProps", async (...args: any[]) => this.getConnectionProps(args[1]));
    ElectronHost.ipcMain.handle("itwin.iModelRead.getToolTipMessage", async (...args: any[]) => this.getToolTipMessage(args[1], args[2]));
  }

  public async getConnectionProps(props: IModelOpenProps): Promise<IModelConnectionProps> {
    return getConnectionProps(props);
  }

  public async getToolTipMessage(iModelAccessProps: IModelAccessProps, elementId: string): Promise<string[]> {
    const iModelDb = IModelDb.tryFindByKey(CheckpointManager.getKey({ ...iModelAccessProps, iTwinId: "" })); // Because our types are 100% accurate, iTwinId is mandatory, but is unused.
    if (!iModelDb)
      throw new Error("iModel not found");

    return iModelDb.elements.getElement(elementId).getToolTipMessage();
  }
}

/** Reusable code for both implementations. */
async function getConnectionProps(props: IModelOpenProps): Promise<IModelConnectionProps> {
  const checkpointProps: CheckpointProps = {
    ...props,
    accessToken: await IModelHost.getAccessToken(),
  };

  let db = IModelDb.tryFindByKey(CheckpointManager.getKey(checkpointProps));
  if (db)
    return db.toJSON();

  try {
    db = await SnapshotDb.openCheckpoint(checkpointProps);
  } catch (e) {
    const request = {
      checkpoint: checkpointProps,
      localFile: V1CheckpointManager.getFileName(checkpointProps),
      aliasFiles: [],
    };
    db = await V1CheckpointManager.getCheckpointDb(request);
  }

  return db.toJSON();
}
