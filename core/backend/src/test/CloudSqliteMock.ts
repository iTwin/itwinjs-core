/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as sinon from "sinon";
import { CloudSqlite } from "../CloudSqlite";
import { HubMock } from "../HubMock";
import * as path from "path";
import { BriefcaseManager } from "../BriefcaseManager";
import { CheckpointProps, V2CheckpointManager } from "../CheckpointManager";
import { V2CheckpointAccessProps } from "../BackendHubAccess";
import { IModelHost } from "../IModelHost";
import { _hubAccess } from "../internal/Symbols";
import { IModelError } from "@itwin/core-common";
import { IModelStatus } from "@itwin/core-bentley";

export class CloudContainerMock {
  public isConnected = false;
  public createArgs: any;
  public containerId = "MockContainerId";
  private _cloudCache?: CloudSqlite.CloudCache;

  constructor(createArgs: any) {
    this.createArgs = createArgs;
  }
  public connect(cache: CloudSqlite.CloudCache) {
    this._cloudCache = cache;
    this.downloadCheckpoint(path.join(cache.rootDir, this.createArgs.checkpoint.iModelId, this.createArgs.dbName));
    this.isConnected = true;
  }
  public disconnect(_args?: { detach?: boolean }) {
    this.isConnected = false;
    this._cloudCache = undefined;
  }
  public downloadCheckpoint(fileName: string) {
    const checkpoint = this.createArgs.checkpoint;
    HubMock.findLocalHub(checkpoint.iModelId).downloadCheckpoint({ changeset: checkpoint.changeset, targetFile: fileName });
  }
  public checkForChanges() {}
  public queryDatabase() {
    return undefined;
  }
  public attach(): { dbName: string, container: CloudSqlite.CloudContainer | undefined } {
    const dbName = path.join(BriefcaseManager.getBriefcaseBasePath(this.createArgs.checkpoint.iModelId), this.createArgs.dbName);
    this.downloadCheckpoint(dbName);
    return { dbName, container: undefined };
  }
}

/**
 * Mocks the CloudSqlite access needed for [[V2CheckpointManager.downloadCheckpoint]].
 * @internal
 */
export class CloudSqliteMock {
  private static _stubs: sinon.SinonStub[] = [];

  /**
   * Begin mocking the CloudSqlite access needed for [[V2CheckpointManager.downloadCheckpoint]]. This uses [[HubMock]] to
   * copy a local file to the target file. Call [[shutdown]] to stop the mocking.
   */
  public static startup() {
    if (this._stubs.length > 0) {
      throw new Error("CloudSqliteMock.startup called twice without calling shutdown");
    }
    const origCreateCloudContainer = CloudSqlite.createCloudContainer;
    const origTransferDb = CloudSqlite.transferDb;
    this._stubs.push(sinon.stub(CloudSqlite, "createCloudContainer").callsFake((args) => {
      if ((args as any).isMock) {
        return new CloudContainerMock(args) as any as CloudSqlite.CloudContainer;
      } else {
        return origCreateCloudContainer(args);
      }
    }));
    this._stubs.push(sinon.stub(CloudSqlite, "transferDb").callsFake(async (direction, container: any, props) => {
      if (container instanceof CloudContainerMock) {
        if (direction === "download") {
          container.downloadCheckpoint(props.localFileName);
        } else {
          throw new Error("Mock transferDb only supports download");
        }
      } else {
        return origTransferDb(direction, container, props);
      }
    }));
    this._stubs.push(sinon.stub(V2CheckpointManager, "attach").callsFake(async (checkpoint: CheckpointProps): Promise<{ dbName: string, container: CloudSqlite.CloudContainer | undefined }> => {
      console.log("CloudSqliteMock attach called"); // eslint-disable-line no-console
      let v2props: V2CheckpointAccessProps | undefined;
      try {
        v2props = await IModelHost[_hubAccess].queryV2Checkpoint(checkpoint);
        if (!v2props)
          throw new Error("no checkpoint");
      } catch (err: any) {
        throw new IModelError(IModelStatus.NotFound, `V2 checkpoint not found: err: ${err.message}`);
      }

      const container = V2CheckpointManager.getContainer(v2props, checkpoint);
      if (container instanceof CloudContainerMock) {
        return container.attach();
      } else {
        throw new Error("Mock attach only supports CloudContainerMock");
      }
    }));
  }

  /**
   * Stop the CloudSqliteMock that was started in [[startup]].
   * Note: This throws an exception if [[startup]] was not called first.
   */
  public static shutdown() {
    if (this._stubs.length > 0) {
      this._stubs.forEach((stub) => stub.restore());
      this._stubs = [];
    } else {
      throw new Error("CloudSqliteMock.shutdown called before startup");
    }
  }
}
