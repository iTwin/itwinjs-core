/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { MobileDevice, MobileHost, NativeQueryHandler } from "../../backend/MobileHost";

async function getRejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error("Expected promise to be rejected");
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("MobileHost", () => {
  const device = Object.create(MobileDevice.prototype) as MobileDevice;

  describe("handleNativeQuery", () => {
    const defaultHandler = MobileHost.nativeQueryHandler;

    const entryPoints: Array<[string, (name: string, message: string) => Promise<string>]> = [
      ["MobileHost.handleNativeQuery", async (name, message) => MobileHost.handleNativeQuery(name, message)],
      ["MobileDevice.handleNativeQuery", async (name, message) => device.handleNativeQuery(name, message)],
    ];

    afterEach(() => {
      MobileHost.nativeQueryHandler = defaultHandler;
    });

    for (const [entryPointName, query] of entryPoints) {
      describe(entryPointName, () => {
        it("rejects when no handler is registered", async () => {
          const err = await getRejection(query("anyQuery", "anyMessage"));
          expect(err).to.be.instanceOf(Error);
          expect((err as Error).message).to.equal("MobileHost query handler not registered.");
        });

        it("resolves with the result of an asynchronous handler", async () => {
          const calls: Array<[string, string]> = [];
          MobileHost.nativeQueryHandler = async (name, message) => {
            calls.push([name, message]);
            await delay(5);
            return `${name}:${message}`;
          };

          expect(await query("echo", "{\"value\":1}")).to.equal("echo:{\"value\":1}");
          expect(calls).to.deep.equal([["echo", "{\"value\":1}"]]);
        });

        it("returns a rejected promise when the handler throws synchronously", async () => {
          const handlerException = new Error("thrown synchronously");
          MobileHost.nativeQueryHandler = () => {
            throw handlerException;
          };

          const result = query("throwing", "");
          expect(result).to.be.instanceOf(Promise);
          expect(await getRejection(result)).to.equal(handlerException);
        });

        it("rejects when handler throws asynchronously", async () => {
          const handlerException = new Error("thrown asynchronously");
          MobileHost.nativeQueryHandler = async () => {
            await delay(5);
            throw handlerException;
          };

          expect(await getRejection(query("throwing", ""))).to.equal(handlerException);
        });

        it("uses the most recently set handler", async () => {
          let firstHandlerReceivedQueryCount = 0;
          const firstHandler: NativeQueryHandler = async () => {
            firstHandlerReceivedQueryCount++;
            return "first";
          };

          const secondHandler: NativeQueryHandler = async () => "second";

          MobileHost.nativeQueryHandler = firstHandler;
          expect(await query("", "")).to.equal("first");

          MobileHost.nativeQueryHandler = secondHandler;
          expect(MobileHost.nativeQueryHandler).to.equal(secondHandler);

          expect(await query("", "")).to.equal("second");
          expect(firstHandlerReceivedQueryCount).to.equal(1);
        });
      });
    }
  });
});
