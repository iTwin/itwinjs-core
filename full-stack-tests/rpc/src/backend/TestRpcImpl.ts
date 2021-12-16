/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyError, BentleyStatus, Id64String } from "@itwin/core-bentley";
import {
  IModelRpcProps, NoContentError, RpcInterface, RpcInvocation, RpcManager, RpcOperationsProfile, RpcPendingResponse, RpcRequest,
} from "@itwin/core-common";
import {
  AttachedInterface, MobileTestInterface, MultipleClientsInterface, RpcTransportTestImpl, TestNotFoundResponse, TestNotFoundResponseCode,
  TestOp1Params, TestRpcInterface, TestRpcInterface2, TestRpcInterface3, TokenValues, WebRoutingInterface, ZeroMajorRpcInterface,
} from "../common/TestRpcInterface";

export async function testInterfaceResource() {
  const data = new Uint8Array(4);
  data[0] = 1;
  data[1] = 2;
  data[2] = 3;
  data[3] = 4;
  return data;
}

let op8Initializer = 0;

export const resetOp8Initializer = () => {
  op8Initializer = 0;
};

export class TestZeroMajorRpcImpl extends RpcInterface implements ZeroMajorRpcInterface {
  public static register() {
    RpcManager.registerImpl(ZeroMajorRpcInterface, TestZeroMajorRpcImpl);
  }

  public async op1(params: TestOp1Params): Promise<number> {
    return params.a + params.b;
  }
}

export class TestRpcImpl extends RpcInterface implements TestRpcInterface {
  public static register() {
    RpcManager.registerImpl(TestRpcInterface, TestRpcImpl);
  }

  public async interceptSendUnknownStatus(): Promise<void> {
    throw new Error("Not intercepted.");
  }

  public async interceptSendTimeoutStatus(): Promise<void> {
    throw new Error("Not intercepted.");
  }

  public async op1(params: TestOp1Params): Promise<number> {
    return params.a + params.b;
  }

  public async op2(id: Id64String): Promise<Id64String> {
    const val = id;
    return val;
  }

  public async op6(data: { x: number, y: number }): Promise<{ x: number, y: number }> {
    const val = data;
    return val;
  }

  public async op7(): Promise<RpcOperationsProfile> {
    const val = RpcRequest.aggregateLoad;
    return val;
  }

  public async op8(x: number, y: number): Promise<{ initializer: number, sum: number }> {
    if (!op8Initializer) {
      op8Initializer = TestRpcInterface.OP8_INITIALIZER;
      throw new RpcPendingResponse(TestRpcInterface.OP8_PENDING_MESSAGE);
    } else {
      const val = { initializer: op8Initializer, sum: x + y };
      return val;
    }
  }

  public async op9(requestId: string): Promise<string> {
    const invocation = RpcInvocation.current(this);
    if (!invocation || invocation.request.id !== requestId)
      throw new Error();

    const val = requestId;
    return val;
  }

  public async op10(): Promise<void> {
    throw new BentleyError(BentleyStatus.ERROR);
  }

  public async op11(input: string, call: number): Promise<string> {
    if (input === "oldvalue") {
      throw new TestNotFoundResponse(TestNotFoundResponseCode.CanRecover);
    } else if (input === "newvalue") {
      if (call === 1) {
        throw new TestNotFoundResponse(TestNotFoundResponseCode.Fatal);
      } else {
        const val = input;
        return val;
      }
    } else {
      throw new Error("Invalid.");
    }
  }

  public async op12(): Promise<Uint8Array> {
    const val = testInterfaceResource();
    return val;
  }

  public async op13(data: Uint8Array): Promise<void> {
    if (data[0] === 1 && data[1] === 2 && data[2] === 3 && data[3] === 4) {
      return;
    } else {
      throw new Error();
    }
  }

  public async op14(x: number, y: number): Promise<number> {
    return x + y;
  }

  public async op15(): Promise<void> {
    return;
  }

  public async op16(token: IModelRpcProps, values: TokenValues): Promise<boolean> {
    return token.key === values.key &&
      token.iTwinId === values.iTwinId &&
      token.iModelId === values.iModelId &&
      token.changeset?.id === values.changeset?.id;
  }

  public async op17() {
    throw new NoContentError();
  }

  public async startCSRFTest(): Promise<void> {
  }

  public async stopCSRFTest(): Promise<void> {
  }

  public async csrfTestEnabled(): Promise<void> {
  }

  public async csrfTestDisabled(): Promise<void> {
  }

  public async noContent() {
    throw new NoContentError();
  }
}

export class TestRpcImpl2 extends RpcInterface implements TestRpcInterface2 {
  public static register() {
    RpcManager.registerImpl(TestRpcInterface2, TestRpcImpl2);
  }

  public static unregister() {
    RpcManager.unregisterImpl(TestRpcInterface2);
  }

  public static instantiate() {
    // Demonstrates how a consumer can create and supply an instance of the RPC implementation class if necessary.
    const instance = new TestRpcImpl2();
    RpcManager.supplyImplInstance(TestRpcInterface2, instance);
  }

  public async op1(input: number): Promise<number> {
    const val = input;
    return val;
  }
}

export class TestRpcImpl3 extends RpcInterface implements TestRpcInterface3 {
  public static register() {
    RpcManager.registerImpl(TestRpcInterface3, TestRpcImpl3);
  }

  public async op1(input: number): Promise<number> {
    const val = input;
    return val;
  }

  public async op2(size: number, fill: boolean): Promise<Uint8Array> {
    const data = new Uint8Array(size);

    if (fill) {
      for (let i = 0; i !== size; ++i) {
        data[i] = i % 2;
      }
    }

    return data;
  }
}

export class MultipleClientsImpl extends RpcInterface implements MultipleClientsInterface {
  public static register() {
    RpcManager.registerImpl(MultipleClientsInterface, MultipleClientsImpl);
  }

  public async check(id: number): Promise<boolean> {
    const request = RpcInvocation.current(this).request;
    return request.path.indexOf(`rpc-full-stack-test-config${id}`) !== -1;
  }
}

export class AttachedInterfaceImpl extends RpcInterface implements AttachedInterface {
  public static register() {
    RpcManager.registerImpl(AttachedInterface, AttachedInterfaceImpl);
  }

  public async ping(): Promise<boolean> {
    return true;
  }
}

export class WebRoutingInterfaceImpl extends RpcInterface implements WebRoutingInterface {
  public static register() {
    RpcManager.registerImpl(WebRoutingInterface, WebRoutingInterfaceImpl);
  }

  public async ping502(sent: number): Promise<boolean> {
    return (Date.now() - sent) >= 2000;
  }

  public async ping503(sent: number): Promise<boolean> {
    return (Date.now() - sent) >= 1000;
  }

  public async ping504(sent: number): Promise<boolean> {
    return (Date.now() - sent) >= 2000;
  }
}

export class MobileTestInterfaceImpl extends RpcInterface implements MobileTestInterface {
  public static register() {
    RpcManager.registerImpl(MobileTestInterface, MobileTestInterfaceImpl);
  }

  public async multipart(a: number, b: Uint8Array): Promise<number> {
    let s = a;
    b.forEach((v) => s += v);
    return s;
  }
}

TestRpcImpl.register();
TestRpcImpl3.register();
TestZeroMajorRpcImpl.register();
RpcTransportTestImpl.register();
MultipleClientsImpl.register();
WebRoutingInterfaceImpl.register();
MobileTestInterfaceImpl.register();
