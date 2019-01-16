/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { RpcInterface, RpcManager, RpcOperationsProfile, IModelToken, RpcNotFoundResponse } from "@bentley/imodeljs-common";
import { Id64String } from "@bentley/bentleyjs-core";
import { AccessToken } from "@bentley/imodeljs-clients";

export class TestOp1Params {
  public a: number;
  public b: number;

  constructor(a: number, b: number) {
    this.a = a;
    this.b = b;
  }

  public sum() {
    return this.a + this.b;
  }
}

export enum TestNotFoundResponseCode {
  CanRecover,
  Fatal,
}

export class TestNotFoundResponse extends RpcNotFoundResponse {
  public code: TestNotFoundResponseCode;

  constructor(code: TestNotFoundResponseCode) {
    super();
    this.code = code;
  }
}

export abstract class ZeroMajorRpcInterface extends RpcInterface {
  public static version = "0.1.1";
  public static types = () => [TestOp1Params];

  public static getClient(): ZeroMajorRpcInterface {
    return RpcManager.getClientForInterface(ZeroMajorRpcInterface);
  }

  public async op1(_params: TestOp1Params): Promise<number> {
    return this.forward(arguments);
  }
}

export abstract class TestRpcInterface extends RpcInterface {
  public static readonly OP8_INITIALIZER = 5;
  public static readonly OP8_PENDING_MESSAGE = "Initializing op8";

  public static version = "1.1.1";

  public static types = () => [
    TestOp1Params,
    Date,
    Map,
    Set,
    TestNotFoundResponse,
    IModelToken,
    AccessToken,
  ]

  public static getClient(): TestRpcInterface {
    return RpcManager.getClientForInterface(TestRpcInterface);
  }

  public async op1(_params: TestOp1Params): Promise<number> {
    return this.forward(arguments);
  }

  public async op2(_id: Id64String): Promise<Id64String> {
    return this.forward(arguments);
  }

  public async op3(_date: Date): Promise<Date> {
    return this.forward(arguments);
  }

  public async op4(_map: Map<any, any>): Promise<Map<any, any>> {
    return this.forward(arguments);
  }

  public async op5(_set: Set<any>): Promise<Set<any>> {
    return this.forward(arguments);
  }

  public async op6(_data: { x: number, y: number }): Promise<{ x: number, y: number }> {
    return this.forward(arguments);
  }

  public async op7(): Promise<RpcOperationsProfile> {
    return this.forward(arguments);
  }

  public async op8(_x: number, _y: number): Promise<{ initializer: number; sum: number }> {
    return this.forward(arguments);
  }

  /** exposed in test RPC interface so that this functionality can be tested from the frontend perspective */
  public async extractChangeSummaries(_accessToken: AccessToken, _iModelToken: IModelToken, _options: any): Promise<void> {
    return this.forward(arguments);
  }
  public async deleteChangeCache(_iModelToken: IModelToken): Promise<void> {
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
}

export abstract class TestRpcInterface2 extends RpcInterface {
  public static version = "1.0.0";
  public static types = () => [];

  public static getClient(): TestRpcInterface2 {
    return RpcManager.getClientForInterface(TestRpcInterface2);
  }

  public async op1(_input: number): Promise<number> {
    return this.forward(arguments);
  }
}

export abstract class TestRpcInterface3 extends RpcInterface {
  public static version = "1.0.0";
  public static types = () => [];

  public static getClient(): TestRpcInterface3 {
    return RpcManager.getClientForInterface(TestRpcInterface3);
  }

  public async op1(_input: number): Promise<number> {
    return this.forward(arguments);
  }
}

export abstract class RpcTransportTest extends RpcInterface {
  public static version = "1.0.0";
  public static types = () => [];

  public abstract primitive(_value: string): Promise<string>;
  public abstract binary(_value: Uint8Array): Promise<Uint8Array>;
  public abstract mixed(_value1: string, _value2: Uint8Array): Promise<{ 0: string, 1: Uint8Array }>;
  public abstract nested(_value: { a: { x: Uint8Array, y: number }, b: string, c: Uint8Array }): Promise<{ a: { x: Uint8Array, y: number }, b: string, c: Uint8Array }>;
}

export abstract class RpcWebTransportTest extends RpcTransportTest {
  public static getClient(): RpcWebTransportTest { return RpcManager.getClientForInterface(RpcWebTransportTest); }
  public async primitive(_value: string): Promise<string> { return this.forward(arguments); }
  public async binary(_value: Uint8Array): Promise<Uint8Array> { return this.forward(arguments); }
  public async mixed(_value1: string, _value2: Uint8Array): Promise<{ 0: string, 1: Uint8Array }> { return this.forward(arguments); }
  public async nested(_value: { a: { x: Uint8Array, y: number }, b: string, c: Uint8Array }): Promise<{ a: { x: Uint8Array, y: number }, b: string, c: Uint8Array }> { return this.forward(arguments); }
}

export abstract class RpcElectronTransportTest extends RpcTransportTest {
  public static getClient(): RpcElectronTransportTest { return RpcManager.getClientForInterface(RpcElectronTransportTest); }
  public async primitive(_value: string): Promise<string> { return this.forward(arguments); }
  public async binary(_value: Uint8Array): Promise<Uint8Array> { return this.forward(arguments); }
  public async mixed(_value1: string, _value2: Uint8Array): Promise<{ 0: string, 1: Uint8Array }> { return this.forward(arguments); }
  public async nested(_value: { a: { x: Uint8Array, y: number }, b: string, c: Uint8Array }): Promise<{ a: { x: Uint8Array, y: number }, b: string, c: Uint8Array }> { return this.forward(arguments); }
}

export abstract class RpcMobileTransportTest extends RpcTransportTest {
  public static getClient(): RpcMobileTransportTest { return RpcManager.getClientForInterface(RpcMobileTransportTest); }
  public async primitive(_value: string): Promise<string> { return this.forward(arguments); }
  public async binary(_value: Uint8Array): Promise<Uint8Array> { return this.forward(arguments); }
  public async mixed(_value1: string, _value2: Uint8Array): Promise<{ 0: string, 1: Uint8Array }> { return this.forward(arguments); }
  public async nested(_value: { a: { x: Uint8Array, y: number }, b: string, c: Uint8Array }): Promise<{ a: { x: Uint8Array, y: number }, b: string, c: Uint8Array }> { return this.forward(arguments); }
}

export abstract class RpcDirectTransportTest extends RpcTransportTest {
  public static getClient(): RpcDirectTransportTest { return RpcManager.getClientForInterface(RpcDirectTransportTest); }
  public async primitive(_value: string): Promise<string> { return this.forward(arguments); }
  public async binary(_value: Uint8Array): Promise<Uint8Array> { return this.forward(arguments); }
  public async mixed(_value1: string, _value2: Uint8Array): Promise<{ 0: string, 1: Uint8Array }> { return this.forward(arguments); }
  public async nested(_value: { a: { x: Uint8Array, y: number }, b: string, c: Uint8Array }): Promise<{ a: { x: Uint8Array, y: number }, b: string, c: Uint8Array }> { return this.forward(arguments); }
}

export class RpcTransportTestImpl extends RpcInterface implements RpcTransportTest {
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
    return Promise.resolve(RpcTransportTestImpl.mutateString(value));
  }

  public async binary(value: Uint8Array): Promise<Uint8Array> {
    return Promise.resolve(RpcTransportTestImpl.mutateBits(value));
  }

  public async mixed(value1: string, value2: Uint8Array): Promise<{ 0: string, 1: Uint8Array }> {
    return Promise.resolve({ 0: RpcTransportTestImpl.mutateString(value1), 1: RpcTransportTestImpl.mutateBits(value2) });
  }

  public async nested(value: { a: { x: Uint8Array, y: number }, b: string, c: Uint8Array }): Promise<{ a: { x: Uint8Array, y: number }, b: string, c: Uint8Array }> {
    return Promise.resolve({
      a: {
        x: RpcTransportTestImpl.mutateBits(value.a.x),
        y: RpcTransportTestImpl.mutateNumber(value.a.y),
      },
      b: RpcTransportTestImpl.mutateString(value.b),
      c: RpcTransportTestImpl.mutateBits(value.c),
    });
  }
}
