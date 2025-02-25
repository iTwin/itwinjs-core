/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as sinon from "sinon";
import { CloudSqlite } from "./CloudSqlite";
import { HubMock } from "./HubMock";
import { CheckpointProps } from "./CheckpointManager";

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
    // eslint-disable-next-line no-debugger
    debugger;
    if (this._stubs.length > 0) {
      throw new Error("CloudSqliteMock.startup called twice without calling shutdown");
    }
    const origCreateCloudContainer = CloudSqlite.createCloudContainer;
    const origTransferDb = CloudSqlite.transferDb;
    this._stubs.push(sinon.stub(CloudSqlite, "createCloudContainer").callsFake((args) => {
      if ((args as any).isMock) {
        return { createArgs: args } as any as CloudSqlite.CloudContainer;
      } else {
        return origCreateCloudContainer(args);
      }
    }));
    this._stubs.push(sinon.stub(CloudSqlite, "transferDb").callsFake(async (direction, container: any, props) => {
      if (container.createArgs?.isMock) {
        if (direction !== "download") {
          const checkpoint = container.createArgs.checkpoint as CheckpointProps;
          HubMock.findLocalHub(checkpoint.iModelId).downloadCheckpoint({ changeset: checkpoint.changeset, targetFile: props.localFileName });
        } else {
          throw new Error("Mock transferDb only supports download");
        }
      } else {
        return origTransferDb(direction, container, props);
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
