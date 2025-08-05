import { RpcManager } from "@itwin/core-common";
import { IModelConnection, IModelRoutingContext, SnapshotConnection } from "@itwin/core-frontend";
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";

export class TestSnapshotConnection extends SnapshotConnection {
  public static override async openFile(filePath: string): Promise<SnapshotConnection> {
    const routingContext = IModelRoutingContext.current || IModelRoutingContext.default;
    RpcManager.setIModel({ iModelId: "undefined", key: filePath });

    const openResponse = await DisplayPerfRpcInterface.getClient().openSnapshot(filePath);
    const connection = new TestSnapshotConnection(openResponse);
    connection.routingContext = routingContext;
    IModelConnection.onOpen.raiseEvent(connection);
    return connection;
  }

  public override async close(): Promise<void> {
    if (this.isClosed)
      return;

    this.beforeClose();
    try {
      if (!this.isRemote) {
        await DisplayPerfRpcInterface.getClient().closeIModel(this.key);
      }
    } finally {
      this["_isClosed"] = true; // eslint-disable-line @typescript-eslint/dot-notation
    }
  }
}
