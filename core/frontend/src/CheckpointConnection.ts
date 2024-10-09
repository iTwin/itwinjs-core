/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelConnection
 */

import { BentleyError, GuidString, Logger } from "@itwin/core-bentley";
import {
  IModelConnectionProps,
  IModelRpcOpenProps,
  IModelVersion,
  RpcManager,
  RpcNotFoundResponse,
  RpcRequest,
} from "@itwin/core-common";
import { FrontendLoggerCategory } from "./common/FrontendLoggerCategory";
import { IModelApp } from "./IModelApp";
import { IModelConnection } from "./IModelConnection";
import { IModelRoutingContext } from "./IModelRoutingContext";
import { IpcApp } from "./IpcApp";
import { IModelReadHTTPClient } from "@itwin/imodelread-client";

const loggerCategory = FrontendLoggerCategory.IModelConnection;

/**
 * An IModelConnection to a Checkpoint of an iModel.
 * @see [CheckpointConnection]($docs/learning/frontend/IModelConnection)
 * @public
 */
export class CheckpointConnection extends IModelConnection {
  private readonly _fromIpc: boolean;

  /** The Guid that identifies the iTwin that owns this iModel. */
  public override get iTwinId(): GuidString {
    return super.iTwinId!;
  }
  /** The Guid that identifies this iModel. */
  public override get iModelId(): GuidString {
    return super.iModelId!;
  }

  /** Returns `true` if [[close]] has already been called. */
  public get isClosed(): boolean {
    return this._isClosed ? true : false;
  }
  protected _isClosed?: boolean;

  protected constructor(props: IModelConnectionProps, fromIpc: boolean) {
    super(props);
    this._fromIpc = fromIpc;
  }

  /** Type guard for instanceof [[CheckpointConnection]] */
  public override isCheckpointConnection(): this is CheckpointConnection {
    return true;
  }

  /**
   * Open a readonly IModelConnection to a Checkpoint of an iModel.
   */
  public static async openRemote(
    iTwinId: GuidString,
    iModelId: GuidString,
    version = IModelVersion.latest(),
  ): Promise<CheckpointConnection> {
    if (undefined === IModelApp.hubAccess) throw new Error("Missing an implementation of IModelApp.hubAccess");

    const accessToken = await IModelApp.getAccessToken();
    const changeset = await IModelApp.hubAccess.getChangesetFromVersion({ accessToken, iModelId, version });

    let connection: CheckpointConnection;
    const iModelProps = { iTwinId, iModelId, changeset };
    if (IpcApp.isValid) {
      connection = new this(await IpcApp.appFunctionIpc.openCheckpoint(iModelProps), true);
    } else {
      const routingContext = IModelRoutingContext.current || IModelRoutingContext.default;
      connection = new this(await this.callOpen(iModelProps), false);
      RpcManager.setIModel(connection);
      connection.routingContext = routingContext;
      RpcRequest.notFoundHandlers.addListener(connection._reopenConnectionHandler);
    }

    IModelConnection.onOpen.raiseEvent(connection);
    return connection;
  }

  private static async callOpen(iModelToken: IModelRpcOpenProps): Promise<IModelConnectionProps> {
    Logger.logTrace(loggerCategory, `IModelConnection.open`, iModelToken);

    return {
      ...(await new IModelReadHTTPClient(
        `http://localhost:3001/itwins/${iModelToken.iTwinId}/imodels/${iModelToken.iModelId}/changesets/${iModelToken.changeset?.id || "0"}/`,
        IModelApp,
      ).getConnectionProps()),
      ...iModelToken,
      key: `${iModelToken.iModelId}:${iModelToken.changeset?.id ?? ""}`,
    };
  }

  private _reopenConnectionHandler = async (
    request: RpcRequest<RpcNotFoundResponse>,
    response: any,
    resubmit: () => void,
    reject: (reason?: any) => void,
  ) => {
    if (!response.hasOwnProperty("isIModelNotFoundResponse")) reject();

    const iModelRpcProps = request.parameters[0];
    if (this._fileKey !== iModelRpcProps.key) reject(); // The handler is called for a different connection than this

    Logger.logTrace(loggerCategory, "Attempting to reopen connection", () => iModelRpcProps);

    try {
      const openResponse = await CheckpointConnection.callOpen(iModelRpcProps);
      // The new/reopened connection may have a new rpcKey and/or changesetId, but the other IModelRpcTokenProps should be the same
      this._fileKey = openResponse.key;
      this.changeset = openResponse.changeset!;
    } catch (error) {
      reject(BentleyError.getErrorMessage(error));
    } finally {
    }

    Logger.logTrace(loggerCategory, "Resubmitting original request after reopening connection", iModelRpcProps);
    request.parameters[0] = this.getRpcProps(); // Modify the token of the original request before resubmitting it.
    resubmit();
  };

  /** Close this CheckpointConnection */
  public async close(): Promise<void> {
    if (this.isClosed) return;

    this.beforeClose();
    if (this._fromIpc) await IpcApp.appFunctionIpc.closeIModel(this._fileKey);
    else RpcRequest.notFoundHandlers.removeListener(this._reopenConnectionHandler);

    this._isClosed = true;
  }
}
