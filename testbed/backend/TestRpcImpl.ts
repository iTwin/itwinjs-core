/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { TestRpcInterface, TestOp1Params, TestRpcInterface2, TestRpcInterface3, TestNotFoundResponse, TestNotFoundResponseCode } from "../common/TestRpcInterface";
import { RpcInterface, RpcManager, RpcRequest, RpcOperationsProfile, RpcPendingResponse, IModelToken, RpcInvocation } from "@bentley/imodeljs-common";
import { BentleyError, BentleyStatus, Id64 } from "@bentley/bentleyjs-core";
import { BriefcaseManager, ChangeSummaryManager, ChangeSummaryExtractOptions, IModelDb, IModelJsFs } from "@bentley/imodeljs-backend";

let op8Initializer = 0;

export const resetOp8Initializer = () => {
  op8Initializer = 0;
};

export class TestRpcImpl extends RpcInterface implements TestRpcInterface {
  public static register() {
    RpcManager.registerImpl(TestRpcInterface, TestRpcImpl);
  }

  public async op1(params: TestOp1Params): Promise<number> {
    return params.sum();
  }

  public async op2(id: Id64): Promise<Id64> {
    return id;
  }

  public async op3(date: Date): Promise<Date> {
    return date;
  }

  public async op4(map: Map<any, any>): Promise<Map<any, any>> {
    return map;
  }

  public async op5(set: Set<any>): Promise<Set<any>> {
    return set;
  }

  public async op6(data: { x: number, y: number }): Promise<{ x: number, y: number }> {
    return data;
  }

  public async op7(): Promise<RpcOperationsProfile> {
    return RpcRequest.aggregateLoad;
  }

  public async op8(x: number, y: number): Promise<{ initializer: number; sum: number }> {
    if (!op8Initializer) {
      op8Initializer = TestRpcInterface.OP8_INITIALIZER;
      throw new RpcPendingResponse(TestRpcInterface.OP8_PENDING_MESSAGE);
    } else {
      return { initializer: op8Initializer, sum: x + y };
    }
  }

  public async extractChangeSummaries(iModelToken: IModelToken, options: any): Promise<void> {
    await ChangeSummaryManager.extractChangeSummaries(IModelDb.find(iModelToken), options as ChangeSummaryExtractOptions);
  }

  public async deleteChangeCache(iModelToken: IModelToken): Promise<void> {
    if (!iModelToken.iModelId)
      throw new Error("iModelToken is invalid. Must not be a standalone iModel");

    const changesPath: string = BriefcaseManager.getChangeCachePathName(iModelToken.iModelId);
    if (IModelJsFs.existsSync(changesPath))
      IModelJsFs.unlinkSync(changesPath);
  }

  public async op9(requestId: string): Promise<string> {
    const invocation = RpcInvocation.current(this);
    if (!invocation || invocation.request.id !== requestId)
      throw new Error();

    return requestId;
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
        return input;
      }
    } else {
      throw new Error("Invalid.");
    }
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
    return input;
  }
}

export class TestRpcImpl3 extends RpcInterface implements TestRpcInterface3 {
  public static register() {
    RpcManager.registerImpl(TestRpcInterface3, TestRpcImpl3);
  }

  public async op1(input: number): Promise<number> {
    return input;
  }
}
