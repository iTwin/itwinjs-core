/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { executeBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";
import { assert } from "chai";
import { BackendTestCallbacks } from "../common/SideChannels";
import { testChannel } from "../common/TestRpcInterface";

describe("Rpc.Push", () => {
  it("should support push events", async () => {
    return new Promise(async (resolve) => {
      const messages: number[] = [];

      testChannel.subscribe().onMessage.addListener((message) => {
        messages.push(message);

        if (messages.length === 3) {
          assert.equal(messages[0], 1);
          assert.equal(messages[1], 2);
          assert.equal(messages[2], 3);
          resolve();
        }
      });

      assert(await executeBackendCallback(BackendTestCallbacks.startPushTest));
    });
  });
});
