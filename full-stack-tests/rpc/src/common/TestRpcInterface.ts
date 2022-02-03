/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { Id64String } from "@itwin/core-bentley";
import type { IModelRpcProps, RpcInterfaceDefinition, RpcOperationsProfile} from "@itwin/core-common";
import {
  IModelReadRpcInterface, RpcInterface, RpcManager, RpcNotFoundResponse,
  RpcPushChannel, RpcRoutingToken, WipRpcInterface,
} from "@itwin/core-common";

export const testChannel = RpcPushChannel.create<number>("test");

export interface TestOp1Params {
  a: number;
  b: number;
}

export enum TestNotFoundResponseCode {
  CanRecover,
  Fatal,
}

export class TestNotFoundResponse extends RpcNotFoundResponse {
  public isTestNotFoundResponse: true;
  public code: TestNotFoundResponseCode;

  constructor(code: TestNotFoundResponseCode) {
    super();
    this.isTestNotFoundResponse = true;
    this.code = code;
  }
}

export abstract class ZeroMajorRpcInterface extends RpcInterface {
  public static readonly interfaceName = "ZeroMajorRpcInterface";
  public static interfaceVersion = "0.1.1";

  public static getClient(): ZeroMajorRpcInterface {
    return RpcManager.getClientForInterface(ZeroMajorRpcInterface);
  }

  public async op1(_params: TestOp1Params): Promise<number> {
    return this.forward(arguments);
  }
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface TokenValues extends IModelRpcProps { }

export abstract class TestRpcInterface extends RpcInterface {
  public static readonly OP8_INITIALIZER = 5;
  public static readonly OP8_PENDING_MESSAGE = "Initializing op8";

  public static readonly interfaceName = "TestRpcInterface";
  public static interfaceVersion = "1.1.1";

  public static getClient(): TestRpcInterface {
    return RpcManager.getClientForInterface(TestRpcInterface);
  }

  public async interceptSendUnknownStatus(): Promise<void> {
    return this.forward(arguments);
  }

  public async interceptSendTimeoutStatus(): Promise<void> {
    return this.forward(arguments);
  }

  public async op1(_params: TestOp1Params): Promise<number> {
    return this.forward(arguments);
  }

  public async op2(_id: Id64String): Promise<Id64String> {
    return this.forward(arguments);
  }

  public async op6(_data: { x: number, y: number }): Promise<{ x: number, y: number }> {
    return this.forward(arguments);
  }

  public async op7(): Promise<RpcOperationsProfile> {
    return this.forward(arguments);
  }

  public async op8(_x: number, _y: number): Promise<{ initializer: number, sum: number }> {
    return this.forward(arguments);
  }

  public async op9(_requestId: string): Promise<string> {
    return this.forward(arguments);
  }

  public async op10(): Promise<void> {
    return this.forward(arguments);
  }

  public async op11(_input: string, _call: number): Promise<string> {
    return this.forward(arguments);
  }

  public async op12(): Promise<Uint8Array> {
    return this.forward(arguments);
  }

  public async op13(_data: Uint8Array): Promise<void> {
    return this.forward(arguments);
  }

  public async op14(_x: number, _y: number): Promise<number> {
    return this.forward(arguments);
  }

  public async op15(): Promise<void> {
    return this.forward(arguments);
  }

  public async op16(_token: IModelRpcProps, _values: TokenValues): Promise<boolean> {
    return this.forward(arguments);
  }

  public async op17() {
    return this.forward(arguments);
  }

  public async startCSRFTest(): Promise<void> {
    return this.forward(arguments);
  }

  public async stopCSRFTest(): Promise<void> {
    return this.forward(arguments);
  }

  public async csrfTestEnabled(): Promise<void> {
    return this.forward(arguments);
  }

  public async csrfTestDisabled(): Promise<void> {
    return this.forward(arguments);
  }

  public async noContent() {
    return this.forward(arguments);
  }
}

export abstract class TestRpcInterface2 extends RpcInterface {
  public static readonly interfaceName = "TestRpcInterface2";
  public static interfaceVersion = "1.0.0";

  public static getClient(): TestRpcInterface2 {
    return RpcManager.getClientForInterface(TestRpcInterface2);
  }

  public async op1(_input: number): Promise<number> {
    return this.forward(arguments);
  }
}

export abstract class TestRpcInterface3 extends RpcInterface {
  public static readonly interfaceName = "TestRpcInterface3";
  public static interfaceVersion = "1.0.0";

  public static getClient(): TestRpcInterface3 {
    return RpcManager.getClientForInterface(TestRpcInterface3);
  }

  public async op1(_input: number): Promise<number> {
    return this.forward(arguments);
  }

  public async op2(_size: number, _fill: boolean): Promise<Uint8Array> {
    return this.forward(arguments);
  }
}

export abstract class RpcTransportTest extends RpcInterface {
  public static readonly interfaceName = "RpcTransportTest";
  public static interfaceVersion = "1.0.0";

  public static getClient(): RpcTransportTest { return RpcManager.getClientForInterface(RpcTransportTest); }
  public async primitive(_value: string): Promise<string> { return this.forward(arguments); }
  public async binary(_value: Uint8Array): Promise<Uint8Array> { return this.forward(arguments); }
  public async mixed(_value1: string, _value2: Uint8Array): Promise<{ 0: string, 1: Uint8Array }> { return this.forward(arguments); }
  public async nested(_value: { a: { x: Uint8Array, y: number }, b: string, c: Uint8Array }): Promise<{ a: { x: Uint8Array, y: number }, b: string, c: Uint8Array }> { return this.forward(arguments); }
}

export class RpcTransportTestImpl extends RpcInterface implements RpcTransportTest {
  public static register() {
    RpcManager.registerImpl(RpcTransportTest, RpcTransportTestImpl);
  }

  public static mutateString(value: string): string {
    return value.toUpperCase();
  }

  public static mutateNumber(value: number): number {
    return value * -1;
  }

  public static mutateBits(value: Uint8Array): Uint8Array {
    const mutated = new Uint8Array(value.byteLength);
    value.forEach((v, i) => mutated[i] = ~v);
    return mutated;
  }

  public async primitive(value: string): Promise<string> {
    return RpcTransportTestImpl.mutateString(value);
  }

  public async binary(value: Uint8Array): Promise<Uint8Array> {
    return RpcTransportTestImpl.mutateBits(value);
  }

  public async mixed(value1: string, value2: Uint8Array): Promise<{ 0: string, 1: Uint8Array }> {
    return { 0: RpcTransportTestImpl.mutateString(value1), 1: RpcTransportTestImpl.mutateBits(value2) };
  }

  public async nested(value: { a: { x: Uint8Array, y: number }, b: string, c: Uint8Array }): Promise<{ a: { x: Uint8Array, y: number }, b: string, c: Uint8Array }> {
    return {
      a: {
        x: RpcTransportTestImpl.mutateBits(value.a.x),
        y: RpcTransportTestImpl.mutateNumber(value.a.y),
      },
      b: RpcTransportTestImpl.mutateString(value.b),
      c: RpcTransportTestImpl.mutateBits(value.c),
    };
  }
}

export abstract class MultipleClientsInterface extends RpcInterface {
  public static readonly interfaceName = "MultipleClientsInterface";
  public static interfaceVersion = "1.0.0";

  public static config1 = RpcRoutingToken.generate();
  public static config2 = RpcRoutingToken.generate();

  public static getClientWithRouting(routing: RpcRoutingToken): MultipleClientsInterface {
    return RpcManager.getClientForInterface(MultipleClientsInterface, routing);
  }

  public async check(_id: number): Promise<boolean> {
    return this.forward(arguments);
  }
}

export abstract class AttachedInterface extends RpcInterface {
  public static readonly interfaceName = "AttachedInterface";
  public static interfaceVersion = "1.0.0";

  public static getClient(): AttachedInterface {
    return RpcManager.getClientForInterface(AttachedInterface);
  }

  public async ping(): Promise<boolean> {
    return this.forward(arguments);
  }
}

export abstract class WebRoutingInterface extends RpcInterface {
  public static readonly interfaceName = "WebRoutingInterface";
  public static interfaceVersion = "1.0.0";

  public static getClient(): WebRoutingInterface {
    return RpcManager.getClientForInterface(WebRoutingInterface);
  }

  public async ping502(_sent: number): Promise<boolean> {
    return this.forward(arguments);
  }

  public async ping503(_sent: number): Promise<boolean> {
    return this.forward(arguments);
  }

  public async ping504(_sent: number): Promise<boolean> {
    return this.forward(arguments);
  }
}

export abstract class MobileTestInterface extends RpcInterface {
  public static readonly interfaceName = "MobileTestInterface";
  public static interfaceVersion = "1.0.0";

  public static getClient(): MobileTestInterface {
    return RpcManager.getClientForInterface(MobileTestInterface);
  }

  public async multipart(_a: number, _b: Uint8Array): Promise<number> {
    return this.forward(arguments);
  }
}

export const rpcInterfaces: RpcInterfaceDefinition[] = [
  IModelReadRpcInterface,
  TestRpcInterface,
  TestRpcInterface2,
  TestRpcInterface3,
  RpcTransportTest,
  WipRpcInterface,
  ZeroMajorRpcInterface,
  MultipleClientsInterface,
  WebRoutingInterface,
];
