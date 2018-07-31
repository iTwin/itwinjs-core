/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { RpcRequest, RpcManager, RpcOperation, RpcRequestEvent, RpcInterface, RpcInterfaceDefinition, RpcConfiguration, IModelReadRpcInterface, IModelToken } from "@bentley/imodeljs-common";
import { TestRpcInterface, TestOp1Params, TestRpcInterface2, TestNotFoundResponse, TestNotFoundResponseCode } from "../common/TestRpcInterface";
import { assert } from "chai";
import { BentleyError, Id64 } from "@bentley/bentleyjs-core";
import { TestbedConfig } from "../common/TestbedConfig";
import { CONSTANTS } from "../common/Testbed";

const timeout = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("RpcInterface", () => {
  class LocalInterface extends RpcInterface {
    public static version = "0.0.0";
    public static types = () => [];
    public op(): Promise<void> { return this.forward.apply(this, arguments); }
  }

  const initializeLocalInterface = () => {
    RpcManager.registerImpl(LocalInterface, class extends RpcInterface {
      public op(): Promise<void> { return undefined as any; }
    });

    RpcManager.initializeInterface(LocalInterface);
  };

  const terminateLocalInterface = () => {
    RpcManager.terminateInterface(LocalInterface);
  };

  it("should marshall types over the wire", async () => {
    const params = new TestOp1Params(1, 1);
    const remoteSum = await TestRpcInterface.getClient().op1(params);
    assert.strictEqual(remoteSum, params.sum());
  });

  it("should support toJSON/fromJSON", async () => {
    const id1 = new Id64();
    const id2 = await TestRpcInterface.getClient().op2(id1);
    assert.isTrue(id1.equals(id2));
  });

  it("should support toJSON and fall back to constructor when fromJSON does not exist", async () => {
    const date1 = new Date();
    const date2 = await TestRpcInterface.getClient().op3(date1);
    assert.strictEqual(date1.getTime(), date2.getTime());
  });

  it("should support Map", async () => {
    const map1 = new Map();
    map1.set(0, "a");
    map1.set("x", 1);
    map1.set(true, { y: "b" });
    map1.set(false, new Date());
    map1.set("params", new TestOp1Params(1, 1));
    map1.set("id", new Id64());

    const map2 = await TestRpcInterface.getClient().op4(map1);
    assert.equal(map1.size, map2.size);

    map2.forEach((v, k) => {
      if (v instanceof Date)
        assert.strictEqual(v.getTime(), map1.get(k).getTime());
      else if (v instanceof Id64)
        assert.isTrue(v.equals(map1.get(k)));
      else if (v instanceof TestOp1Params)
        assert.strictEqual(v.sum(), map1.get(k).sum());
      else if (typeof (v) === "object")
        assert.strictEqual(JSON.stringify(v), JSON.stringify(map1.get(k)));
      else
        assert.strictEqual(v, map1.get(k));
    });
  });

  it("should support Set", async () => {
    const set1 = new Set();
    set1.add(1);
    set1.add("x");
    set1.add(true);
    set1.add({ y: "b" });
    set1.add(new Date());
    set1.add(new TestOp1Params(1, 1));
    set1.add(new Id64());

    const set2 = await TestRpcInterface.getClient().op5(set1);
    assert.equal(set1.size, set2.size);

    const set1Items = Array.from(set1);
    const set2Items = Array.from(set2);

    for (let i = 0; i !== set1Items.length; ++i) {
      const v = set2Items[i];

      if (v instanceof Date)
        assert.strictEqual(v.getTime(), set1Items[i].getTime());
      else if (v instanceof Id64)
        assert.isTrue(v.equals(set1Items[i]));
      else if (v instanceof TestOp1Params)
        assert.strictEqual(v.sum(), set1Items[i].sum());
      else if (typeof (v) === "object")
        assert.strictEqual(JSON.stringify(v), JSON.stringify(set1Items[i]));
      else
        assert.strictEqual(v, set1Items[i]);
    }
  });

  it("should permit an unregistered type", async () => {
    class InternalData {
      constructor(public x: number, public y: number) { }
    }

    const data1 = new InternalData(1, 2);
    const data2 = await TestRpcInterface.getClient().op6(data1);
    assert.strictEqual(data1.x, data2.x);
    assert.strictEqual(data1.y, data2.y);
  });

  it("should report aggregate operation load profile information", async () => {
    const load = RpcRequest.aggregateLoad;
    const frontendInitialReq = load.lastRequest;
    const frontendInitialResp = load.lastResponse;

    await timeout(1);

    const backendAggregate1 = await TestRpcInterface.getClient().op7();
    assert.isAbove(load.lastRequest, frontendInitialReq);
    assert.isAbove(load.lastResponse, frontendInitialResp);

    await timeout(1);

    const backendAggregate2 = await TestRpcInterface.getClient().op7();
    assert.isAbove(backendAggregate2.lastRequest, backendAggregate1.lastRequest);
    assert.isAbove(backendAggregate2.lastResponse, backendAggregate1.lastResponse);
  });

  it("should support pending operations", async () => {
    const op8 = RpcOperation.lookup(TestRpcInterface, "op8");

    let receivedPending = false;

    const removeListener = RpcRequest.events.addListener((type: RpcRequestEvent, request: RpcRequest) => {
      if (type !== RpcRequestEvent.PendingUpdateReceived || request.operation !== op8)
        return;

      request.retryInterval = 1;
      assert.isFalse(receivedPending);
      receivedPending = true;
      assert.equal(request.extendedStatus, TestRpcInterface.OP8_PENDING_MESSAGE);
    });

    op8.policy.retryInterval = () => 1;

    const response1 = await TestRpcInterface.getClient().op8(1, 1);
    assert.equal(response1.initializer, TestRpcInterface.OP8_INITIALIZER);
    assert.equal(response1.sum, 2);

    const response2 = await TestRpcInterface.getClient().op8(2, 2);
    assert.equal(response2.initializer, TestRpcInterface.OP8_INITIALIZER);
    assert.equal(response2.sum, 4);

    assert.isTrue(receivedPending);
    removeListener();
    assert(TestbedConfig.sendToMainSync({ name: CONSTANTS.RESET_OP8_INITIALIZER, value: undefined }));
  });

  it("should support supplied RPC implementation instances", async () => {
    try {
      await TestRpcInterface2.getClient().op1(1);
      assert(false);
    } catch (err) {
      assert(true);
    }

    assert(TestbedConfig.sendToMainSync({ name: CONSTANTS.REGISTER_TEST_RPCIMPL2_CLASS_MESSAGE, value: undefined }));

    const response1 = await TestRpcInterface2.getClient().op1(1);
    assert.equal(response1, 1);

    assert(TestbedConfig.sendToMainSync({ name: CONSTANTS.REPLACE_TEST_RPCIMPL2_INSTANCE_MESSAGE, value: undefined }));

    const response2 = await TestRpcInterface2.getClient().op1(2);
    assert.equal(response2, 2);

    assert(TestbedConfig.sendToMainSync({ name: CONSTANTS.UNREGISTER_TEST_RPCIMPL2_CLASS_MESSAGE, value: undefined }));
  });

  it("should allow access to request and invocation objects and allow a custom request id", () => {
    const op9 = RpcOperation.lookup(TestRpcInterface, "op9");

    const customId = "customId";
    let expectedRequest: RpcRequest = undefined as any;

    op9.policy.requestId = (request) => {
      assert(!expectedRequest);
      expectedRequest = request;
      return customId;
    };

    const client = TestRpcInterface.getClient();
    const response = client.op9(customId);
    const associatedRequest = RpcRequest.current(client);
    assert.strictEqual(associatedRequest, expectedRequest);
    assert.equal(associatedRequest.id, customId);

    return response.then((value) => {
      assert.equal(value, customId);
    }, (reason) => assert(false, reason));
  });

  it("should marshal errors over the wire", async () => {
    try {
      await TestRpcInterface.getClient().op10();
      assert(false);
    } catch (err) {
      assert(err instanceof BentleyError);
    }
  });

  it("should allow void return values when using RpcDirectProtocol", async () => {
    initializeLocalInterface();
    await RpcManager.getClientForInterface(LocalInterface).op();
    terminateLocalInterface();
  });

  it("should allow terminating interfaces", async () => {
    try { await RpcManager.getClientForInterface(LocalInterface).op(); assert(false); } catch (err) { assert(true); }
    initializeLocalInterface();
    await RpcManager.getClientForInterface(LocalInterface).op();
    terminateLocalInterface();
    try { await RpcManager.getClientForInterface(LocalInterface).op(); assert(false); } catch (err) { assert(true); }
    initializeLocalInterface();
    await RpcManager.getClientForInterface(LocalInterface).op();
    terminateLocalInterface();
  });

  it("should allow resolving a 'not found' state for a request", async () => {
    const removeResolver = RpcRequest.notFoundHandlers.addListener((request, response, resubmit, reject) => {
      if (!(response instanceof TestNotFoundResponse))
        return;

      setTimeout(() => {
        if (response.code === TestNotFoundResponseCode.CanRecover) {
          assert.strictEqual("oldvalue", request.parameters[0]);
          request.parameters[0] = "newvalue";
          resubmit();
        } else if (response.code === TestNotFoundResponseCode.Fatal) {
          reject(response.code);
        }
      }, 0);
    });

    const opResponse = await TestRpcInterface.getClient().op11("oldvalue", 0);
    assert.strictEqual(opResponse, "newvalue");

    try {
      await TestRpcInterface.getClient().op11("newvalue", 1); // op11 is hard-coded to fail fatally the second time to test reject()
      assert(false);
    } catch (err) {
      assert.strictEqual(err, TestNotFoundResponseCode.Fatal);
      assert(true);
    }

    removeResolver();
  });

  it("should describe available RPC endpoints from the frontend", async () => {
    const controlChannel = IModelReadRpcInterface.getClient().configuration.controlChannel;
    const controlInterface = (controlChannel as any).channelInterface as RpcInterfaceDefinition;
    const originalName = controlInterface.name;
    const controlPolicy = RpcOperation.lookup(controlInterface, "describeEndpoints").policy;

    const simulateIncompatible = () => {
      const interfaces: string[] = [];
      ((controlChannel as any).configuration as RpcConfiguration).interfaces().forEach((definition) => {
        interfaces.push(definition.name === "IModelReadRpcInterface" ? `${definition.name}@0.0.0` : `${definition.name}@${definition.version}`);
      });

      return btoa(interfaces.sort().join(","));
    };

    const endpoints = await RpcManager.describeAvailableEndpoints();
    assert.equal(endpoints[0].interfaceName, "IModelReadRpcInterface");
    assert.equal(endpoints[0].operationNames[0], "openForRead");
    assert(typeof (endpoints[0].interfaceVersion) === "string");
    assert.isTrue(endpoints[0].compatible);

    controlPolicy.sentCallback = () => Object.defineProperty(controlInterface, "name", { value: simulateIncompatible() });
    assert(TestbedConfig.sendToMainSync({ name: CONSTANTS.SET_INCOMPATIBLE_INTERFACE_VERSION, value: undefined }));

    const endpointsMismatch = await RpcManager.describeAvailableEndpoints();
    assert.isFalse(endpointsMismatch[0].compatible);

    controlPolicy.sentCallback = () => { };
    Object.defineProperty(controlInterface, "name", { value: originalName });
    assert(TestbedConfig.sendToMainSync({ name: CONSTANTS.RESTORE_COMPATIBLE_INTERFACE_VERSION, value: undefined }));

    const endpointsRestored = await RpcManager.describeAvailableEndpoints();
    assert.isTrue(endpointsRestored[0].compatible);

    RpcOperation.fallbackToken = new IModelToken("test", "test", "test", "test");
    assert.equal(controlPolicy.token(undefined as any)!.contextId, "test");
    RpcOperation.fallbackToken = undefined;
    assert.equal(controlPolicy.token(undefined as any)!.contextId, "none");
  });

  it("should support retrieving binary resources from the backend", async () => {
    const data = await TestRpcInterface.getClient().op12();
    assert.equal(data.byteLength, 4);
    const view = new Uint8Array(data);
    assert.equal(view[0], 1);
    assert.equal(view[1], 2);
    assert.equal(view[2], 3);
    assert.equal(view[3], 4);
  });
});
