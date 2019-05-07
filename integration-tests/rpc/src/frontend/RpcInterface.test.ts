/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import {
  RpcRequest,
  RpcManager,
  RpcOperation,
  RpcRequestEvent,
  RpcInterface,
  RpcInterfaceDefinition,
  RpcConfiguration,
  IModelReadRpcInterface,
  IModelToken,
  RpcResponseCacheControl,
  WipRpcInterface,
  RpcOperationPolicy,
} from "@bentley/imodeljs-common";
import { BentleyError, Id64, OpenMode, SerializedClientRequestContext } from "@bentley/bentleyjs-core";
import {
  TestRpcInterface,
  TestOp1Params,
  TestRpcInterface2,
  TestNotFoundResponse,
  TestNotFoundResponseCode,
  RpcTransportTestImpl,
  RpcTransportTest,
  ZeroMajorRpcInterface,
  TokenValues,
} from "../common/TestRpcInterface";
import { assert } from "chai";
import { BackendTestCallbacks } from "../common/SideChannels";
import * as semver from "semver";
import { executeBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";

const timeout = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("RpcInterface", () => {
  class LocalInterface extends RpcInterface {
    public static version = "0.0.0";
    public static types = () => [];
    public async op(): Promise<void> { return this.forward(arguments); }
  }

  const initializeLocalInterface = () => {
    RpcManager.registerImpl(LocalInterface, class extends RpcInterface {
      public async op(): Promise<void> { return undefined as any; }
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
    const id1 = Id64.invalid;
    const id2 = await TestRpcInterface.getClient().op2(id1);
    assert.equal(id1, id2);
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
    map1.set("id", Id64.invalid);

    const map2 = await TestRpcInterface.getClient().op4(map1);
    assert.equal(map1.size, map2.size);

    map2.forEach((v, k) => {
      if (v instanceof Date)
        assert.strictEqual(v.getTime(), map1.get(k).getTime());
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
    set1.add(Id64.invalid);

    const set2 = await TestRpcInterface.getClient().op5(set1);
    assert.equal(set1.size, set2.size);

    const set1Items = Array.from(set1);
    const set2Items = Array.from(set2);

    for (let i = 0; i !== set1Items.length; ++i) {
      const v = set2Items[i];

      if (v instanceof Date)
        assert.strictEqual(v.getTime(), set1Items[i].getTime());
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

  it("should report aggregate operation load profile information #FIXME-direct", async () => {
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

  it("should support pending operations #FIXME-direct", async () => {
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

    assert(await executeBackendCallback(BackendTestCallbacks.resetOp8Initializer));
  });

  it("should support supplied RPC implementation instances", async () => {
    try {
      await TestRpcInterface2.getClient().op1(1);
      assert(false);
    } catch (err) {
      assert(true);
    }

    assert(await executeBackendCallback(BackendTestCallbacks.registerTestRpcImpl2Class));

    const response1 = await TestRpcInterface2.getClient().op1(1);
    assert.equal(response1, 1);

    assert(await executeBackendCallback(BackendTestCallbacks.replaceTestRpcImpl2Instance));

    const response2 = await TestRpcInterface2.getClient().op1(2);
    assert.equal(response2, 2);

    assert(await executeBackendCallback(BackendTestCallbacks.unregisterTestRpcImpl2Class));
  });

  it("should allow access to request and invocation objects and allow a custom request id #FIXME-direct", async () => {
    const customId = "customId";
    let expectedRequest: RpcRequest = undefined as any;
    const backupFn = RpcConfiguration.requestContext.getId;
    RpcConfiguration.requestContext.getId = (request: RpcRequest) => {
      assert(!expectedRequest);
      expectedRequest = request;
      return customId;
    };

    const client = TestRpcInterface.getClient();
    const response = client.op9(customId);
    const associatedRequest = RpcRequest.current(client);
    assert.strictEqual(associatedRequest, expectedRequest);
    assert.equal(associatedRequest.id, customId);

    await response.then((value) => {
      assert.equal(value, customId);
    }, (reason) => assert(false, reason));

    RpcConfiguration.requestContext.getId = backupFn;
  });

  it("should marshal errors over the wire #FIXME-direct", async () => {
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

  it("should allow resolving a 'not found' state for a request #FIXME-direct", async () => {
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

  it("should describe available RPC endpoints from the frontend #FIXME-direct", async () => {
    const controlChannel = IModelReadRpcInterface.getClient().configuration.controlChannel;
    const controlInterface = (controlChannel as any)._channelInterface as RpcInterfaceDefinition;
    const originalName = controlInterface.name;
    const controlPolicy = RpcOperation.lookup(controlInterface, "describeEndpoints").policy;

    const simulateIncompatible = () => {
      const interfaces: string[] = [];
      ((controlChannel as any)._configuration as RpcConfiguration).interfaces().forEach((definition) => {
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
    assert(await executeBackendCallback(BackendTestCallbacks.setIncompatibleInterfaceVersion));

    const endpointsMismatch = await RpcManager.describeAvailableEndpoints();
    assert.isFalse(endpointsMismatch[0].compatible);

    controlPolicy.sentCallback = () => { };
    Object.defineProperty(controlInterface, "name", { value: originalName });
    assert(await executeBackendCallback(BackendTestCallbacks.restoreIncompatibleInterfaceVersion));

    const endpointsRestored = await RpcManager.describeAvailableEndpoints();
    assert.isTrue(endpointsRestored[0].compatible);

    RpcOperation.fallbackToken = new IModelToken("test", "test", "test", "test", OpenMode.Readonly);
    assert.equal(controlPolicy.token(undefined as any)!.contextId, "test");
    RpcOperation.fallbackToken = undefined;
    assert.equal(controlPolicy.token(undefined as any)!.contextId, "none");
  });

  it("should support retrieving binary resources from the backend", async () => {
    const data = await TestRpcInterface.getClient().op12();
    assert.equal(data.byteLength, 4);
    assert.equal(data[0], 1);
    assert.equal(data[1], 2);
    assert.equal(data[2], 3);
    assert.equal(data[3], 4);
  });

  it("should support sending binary resources to the backend", async () => {
    const data = new Uint8Array(4);
    data[0] = 1;
    data[1] = 2;
    data[2] = 3;
    data[3] = 4;
    await TestRpcInterface.getClient().op13(data);
  });

  it("should reject a mismatched RPC interface request #FIXME-direct", async () => {
    const realVersion = TestRpcInterface.version;
    const realVersionZ = ZeroMajorRpcInterface.version;

    const test = async (code: string | null, expectValid: boolean, c: TestRpcInterface | ZeroMajorRpcInterface) => {
      return new Promise(async (resolve, reject) => {
        if (code === null) {
          reject();
        }

        TestRpcInterface.version = code as string;
        ZeroMajorRpcInterface.version = code as string;
        try {
          await c.op1(new TestOp1Params(0, 0));
          TestRpcInterface.version = realVersion;
          ZeroMajorRpcInterface.version = realVersionZ;
          if (expectValid) {
            resolve();
          } else {
            reject();
          }
        } catch (err) {
          TestRpcInterface.version = realVersion;
          ZeroMajorRpcInterface.version = realVersionZ;
          if (expectValid) {
            reject();
          } else {
            resolve();
          }
        }
      });
    };

    const client = TestRpcInterface.getClient();
    const clientZ = ZeroMajorRpcInterface.getClient();

    await test("", false, client);
    await test("", false, clientZ);

    const current = semver.parse(realVersion)!;
    const currentZ = semver.parse(realVersionZ)!;

    await test(current.format(), true, client);
    await test(currentZ.format(), true, clientZ);

    const incMajor = semver.parse(realVersion)!;
    incMajor.inc("major");

    const incMajorZ = semver.parse(realVersionZ)!;
    incMajorZ.inc("major");

    await (test(incMajor.format(), false, client));
    await (test(incMajorZ.format(), false, clientZ));

    const incMinor = semver.parse(realVersion)!;
    incMinor.inc("minor");

    const incMinorZ = semver.parse(realVersionZ)!;
    incMinorZ.inc("minor");

    await (test(incMinor.format(), false, client));
    await (test(incMinorZ.format(), false, clientZ));

    const incPatch = semver.parse(realVersion)!;
    incPatch.inc("patch");

    const incPatchZ = semver.parse(realVersionZ)!;
    incPatchZ.inc("patch");

    await (test(incPatch.format(), true, client));
    await (test(incPatchZ.format(), false, clientZ));

    const incPre = semver.parse(realVersion)!;
    incPre.inc("prerelease");

    const incPreZ = semver.parse(realVersionZ)!;
    incPreZ.inc("prerelease");

    await (test(incPre.format(), false, client));
    await (test(incPreZ.format(), false, clientZ));

    const decMajor = semver.parse(realVersion)!;
    --decMajor.major;

    const decMajorZ = semver.parse(realVersionZ)!;
    --decMajorZ.major;

    await (test(decMajor.format(), false, client));
    await (test(decMajorZ.format(), false, clientZ));

    const decMinor = semver.parse(realVersion)!;
    --decMinor.minor;

    const decMinorZ = semver.parse(realVersionZ)!;
    --decMinorZ.minor;

    await (test(decMinor.format(), true, client));
    await (test(decMinorZ.format(), false, clientZ));

    const decPatch = semver.parse(realVersion)!;
    --decPatch.patch;

    const decPatchZ = semver.parse(realVersionZ)!;
    --decPatchZ.patch;

    await (test(decPatch.format(), true, client));
    await (test(decPatchZ.format(), true, clientZ));
  });

  it("should validate transport method #FIXME-http2", async () => {
    function compareBytes(x: Uint8Array, y: Uint8Array) {
      if (x.byteLength !== y.byteLength) {
        return false;
      }

      for (let i = 0; i !== x.byteLength; ++i) {
        if (x[i] !== y[i]) {
          return false;
        }
      }

      return true;
    }

    const abc = "abc";
    const one = 1;
    const oneZero = new Uint8Array([1, 0, 1, 0]);
    const zeroOne = new Uint8Array([0, 1, 0, 1]);

    const client = RpcTransportTest.getClient();

    // exercise
    assert.equal(await client.primitive(abc), RpcTransportTestImpl.mutateString(abc));
    assert(compareBytes(await client.binary(oneZero), RpcTransportTestImpl.mutateBits(oneZero)));
    const mixed = await client.mixed(abc, zeroOne);
    assert.equal(mixed[0], RpcTransportTestImpl.mutateString(abc));
    assert(compareBytes(mixed[1], RpcTransportTestImpl.mutateBits(zeroOne)));
    const nested = await client.nested({ a: { x: oneZero, y: one }, b: abc, c: zeroOne });
    assert(compareBytes(nested.a.x, RpcTransportTestImpl.mutateBits(oneZero)));
    assert.equal(nested.a.y, RpcTransportTestImpl.mutateNumber(one));
    assert.equal(nested.b, RpcTransportTestImpl.mutateString(abc));
    assert(compareBytes(nested.c, RpcTransportTestImpl.mutateBits(zeroOne)));

    // stress
    const singleStressTest = async () => {
      const nested2 = await client.nested({ a: { x: oneZero, y: one }, b: abc, c: zeroOne });
      assert(compareBytes(nested2.a.x, RpcTransportTestImpl.mutateBits(oneZero)));
      assert.equal(nested2.a.y, RpcTransportTestImpl.mutateNumber(one));
      assert.equal(nested2.b, RpcTransportTestImpl.mutateString(abc));
      assert(compareBytes(nested2.c, RpcTransportTestImpl.mutateBits(zeroOne)));
    };
    const promises = new Array<Promise<void>>();
    for (let i = 0; i !== 100; ++i) {
      promises.push(singleStressTest());
    }
    await Promise.all(promises);
  });

  it("should support cachable responses", async () => {
    RpcOperation.lookup(TestRpcInterface, "op14").policy.allowResponseCaching = () => RpcResponseCacheControl.Immutable;
    assert.equal(2, await TestRpcInterface.getClient().op14(1, 1));
  });

  it("should successfully call WipRpcInterface.placeholder", async () => {
    const s: string = await WipRpcInterface.getClient().placeholder(new IModelToken("test", "test", "test", "test", OpenMode.Readonly));
    assert.equal(s, "placeholder");
  });

  it("should send app version to backend #FIXME-direct", async () => {
    const backupFn = RpcConfiguration.requestContext.serialize;

    RpcConfiguration.requestContext.serialize = async (_request): Promise<SerializedClientRequestContext> => {
      const serializedContext: SerializedClientRequestContext = {
        id: "",
        applicationId: "",
        applicationVersion: "testbed1",
        sessionId: "",
      };
      return serializedContext;
    };

    try {
      await TestRpcInterface.getClient().op15();
      assert(true);
    } catch (err) {
      assert(false);
    } finally {
      RpcConfiguration.requestContext.serialize = backupFn;
    }
  });

  it("should transport imodel tokens correctly", async () => {
    RpcOperation.lookup(TestRpcInterface, "op16").policy.token = new RpcOperationPolicy().token;

    async function check(k?: string, c?: string, i?: string, s?: string, o?: OpenMode) {
      const token = new IModelToken(k, c, i, s, o);
      const values: TokenValues = { key: k, contextId: c, iModelId: i, changeSetId: s, openMode: o };
      assert.isTrue(await TestRpcInterface.getClient().op16(token, values));
    }

    await check("key1", "context1", "imodel1", "change1", OpenMode.ReadWrite);
    await check("key1", "context1", "imodel1", "", OpenMode.ReadWrite);
    await check("key1", "context1", "imodel1", undefined, OpenMode.ReadWrite);
    await check("", "context1", "imodel1", "change1", OpenMode.ReadWrite);
    await check(undefined, "context1", "imodel1", "change1", OpenMode.ReadWrite);

    await check("key1", "context1", "imodel1", "change1", OpenMode.Readonly);
    await check("key1", "context1", "imodel1", "", OpenMode.Readonly);
    await check("", "context1", "imodel1", "change1", OpenMode.Readonly);
    await check(undefined, "context1", "imodel1", "change1", OpenMode.Readonly);
  });
});
