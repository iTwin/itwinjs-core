/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { RpcInterface, RpcManager, RpcOperationsProfile, IModelToken, RpcNotFoundResponse } from "@bentley/imodeljs-common";
import { Id64 } from "@bentley/bentleyjs-core";

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

export abstract class TestRpcInterface extends RpcInterface {
  public static readonly OP8_INITIALIZER = 5;
  public static readonly OP8_PENDING_MESSAGE = "Initializing op8";

  public static version = "1.0.0";

  public static types = () => [
    TestOp1Params,
    Id64,
    Date,
    Map,
    Set,
    TestNotFoundResponse,
  ]

  public static getClient(): TestRpcInterface {
    return RpcManager.getClientForInterface(TestRpcInterface);
  }

  public async op1(_params: TestOp1Params): Promise<number> {
    return this.forward.apply(this, arguments);
  }

  public async op2(_id: Id64): Promise<Id64> {
    return this.forward.apply(this, arguments);
  }

  public async op3(_date: Date): Promise<Date> {
    return this.forward.apply(this, arguments);
  }

  public async op4(_map: Map<any, any>): Promise<Map<any, any>> {
    return this.forward.apply(this, arguments);
  }

  public async op5(_set: Set<any>): Promise<Set<any>> {
    return this.forward.apply(this, arguments);
  }

  public async op6(_data: { x: number, y: number }): Promise<{ x: number, y: number }> {
    return this.forward.apply(this, arguments);
  }

  public async op7(): Promise<RpcOperationsProfile> {
    return this.forward.apply(this, arguments);
  }

  public async op8(_x: number, _y: number): Promise<{ initializer: number; sum: number }> {
    return this.forward.apply(this, arguments);
  }

  /** exposed in test RPC interface so that this functionality can be tested from the frontend perspective */
  public async extractChangeSummaries(_iModelToken: IModelToken, _options: any): Promise<void> {
    return this.forward.apply(this, arguments);
  }
  public async deleteChangeCache(_iModelToken: IModelToken): Promise<void> {
    return this.forward.apply(this, arguments);
  }

  public async op9(_requestId: string): Promise<string> {
    return this.forward.apply(this, arguments);
  }

  public async op10(): Promise<void> {
    return this.forward.apply(this, arguments);
  }

  public op11(_input: string, _call: number): Promise<string> {
    return this.forward.apply(this, arguments);
  }
}

export abstract class TestRpcInterface2 extends RpcInterface {
  public static version = "1.0.0";
  public static types = () => [];

  public static getClient(): TestRpcInterface2 {
    return RpcManager.getClientForInterface(TestRpcInterface2);
  }

  public async op1(_input: number): Promise<number> {
    return this.forward.apply(this, arguments);
  }
}

export abstract class TestRpcInterface3 extends RpcInterface {
  public static version = "1.0.0";
  public static types = () => [];

  public static getClient(): TestRpcInterface3 {
    return RpcManager.getClientForInterface(TestRpcInterface3);
  }

  public async op1(_input: number): Promise<number> {
    return this.forward.apply(this, arguments);
  }
}
