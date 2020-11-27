/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { registerBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";
import { RpcPushConnection } from "@bentley/imodeljs-common";
import { BackendTestCallbacks } from "../common/SideChannels";
import { testChannel } from "../common/TestRpcInterface";

export async function setupPushTest(before = async () => { }): Promise<void> {
  registerBackendCallback(BackendTestCallbacks.startPushTest, () => {
    setTimeout(async () => {
      await before();
      const connection = RpcPushConnection.for(testChannel);
      await connection.send(1);
      await connection.send(2);
      await connection.send(3);
    });

    return true;
  });
}
