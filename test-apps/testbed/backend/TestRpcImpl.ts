/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { TestRpcInterface, TestOp1Params, TestRpcInterface2, TestRpcInterface3, TestNotFoundResponse, TestNotFoundResponseCode } from "../common/TestRpcInterface";
import { RpcInterface, RpcManager, RpcRequest, RpcOperationsProfile, RpcPendingResponse, IModelToken, RpcInvocation } from "@bentley/imodeljs-common";
import { BentleyError, BentleyStatus, Id64 } from "@bentley/bentleyjs-core";
import { BriefcaseManager, ChangeSummaryManager, ChangeSummaryExtractOptions, IModelDb, IModelJsFs, IModelActivityContext } from "@bentley/imodeljs-backend";
import { AccessToken } from "@bentley/imodeljs-clients";
import { testInterfaceResource } from "../common/TestbedConfig";

let op8Initializer = 0;

export const resetOp8Initializer = () => {
  op8Initializer = 0;
};

export class TestRpcImpl extends RpcInterface implements TestRpcInterface {
  public static register() {
    RpcManager.registerImpl(TestRpcInterface, TestRpcImpl);
  }

  public async op1(params: TestOp1Params): Promise<number> {
    const activityContext = IModelActivityContext.createForCurrentRpcRequest(this).enter();
    const sum = params.sum();
    activityContext.exit();
    return sum;
  }

  public async op2(id: Id64): Promise<Id64> {
    const activityContext = IModelActivityContext.createForCurrentRpcRequest(this).enter();
    const val = id;
    activityContext.exit();
    return val;
  }

  public async op3(date: Date): Promise<Date> {
    const activityContext = IModelActivityContext.createForCurrentRpcRequest(this).enter();
    const val = date;
    activityContext.exit();
    return val;
  }

  public async op4(map: Map<any, any>): Promise<Map<any, any>> {
    const activityContext = IModelActivityContext.createForCurrentRpcRequest(this).enter();
    const val = map;
    activityContext.exit();
    return val;
  }

  public async op5(set: Set<any>): Promise<Set<any>> {
    const activityContext = IModelActivityContext.createForCurrentRpcRequest(this).enter();
    const val = set;
    activityContext.exit();
    return val;
  }

  public async op6(data: { x: number, y: number }): Promise<{ x: number, y: number }> {
    const activityContext = IModelActivityContext.createForCurrentRpcRequest(this).enter();
    const val = data;
    activityContext.exit();
    return val;
  }

  public async op7(): Promise<RpcOperationsProfile> {
    const activityContext = IModelActivityContext.createForCurrentRpcRequest(this).enter();
    const val = RpcRequest.aggregateLoad;
    activityContext.exit();
    return val;
  }

  public async op8(x: number, y: number): Promise<{ initializer: number; sum: number }> {
    const activityContext = IModelActivityContext.createForCurrentRpcRequest(this).enter();
    if (!op8Initializer) {
      op8Initializer = TestRpcInterface.OP8_INITIALIZER;
      throw new RpcPendingResponse(TestRpcInterface.OP8_PENDING_MESSAGE);
    } else {
      const val = { initializer: op8Initializer, sum: x + y };
      activityContext.exit();
      return val;
    }
  }

  public async extractChangeSummaries(accessToken: AccessToken, iModelToken: IModelToken, options: any): Promise<void> {
    const activityContext = IModelActivityContext.createForCurrentRpcRequest(this).enter();
    activityContext.suspend();
    await ChangeSummaryManager.extractChangeSummaries(accessToken, IModelDb.find(iModelToken), options as ChangeSummaryExtractOptions);
    activityContext.resume();
    activityContext.exit();
  }

  public async deleteChangeCache(iModelToken: IModelToken): Promise<void> {
    const activityContext = IModelActivityContext.createForCurrentRpcRequest(this).enter();
    if (!iModelToken.iModelId)
      throw new Error("iModelToken is invalid. Must not be a standalone iModel");

    const changesPath: string = BriefcaseManager.getChangeCachePathName(iModelToken.iModelId);
    if (IModelJsFs.existsSync(changesPath))
      IModelJsFs.unlinkSync(changesPath);

    activityContext.exit();
  }

  public async op9(requestId: string): Promise<string> {
    const activityContext = IModelActivityContext.createForCurrentRpcRequest(this).enter();
    const invocation = RpcInvocation.current(this);
    if (!invocation || invocation.request.id !== requestId)
      throw new Error();

    const val = requestId;
    activityContext.exit();
    return val;
  }

  public async op10(): Promise<void> {
    const activityContext = IModelActivityContext.createForCurrentRpcRequest(this).enter();
    activityContext;
    throw new BentleyError(BentleyStatus.ERROR);
  }

  public async op11(input: string, call: number): Promise<string> {
    const activityContext = IModelActivityContext.createForCurrentRpcRequest(this).enter();
    if (input === "oldvalue") {
      throw new TestNotFoundResponse(TestNotFoundResponseCode.CanRecover);
    } else if (input === "newvalue") {
      if (call === 1) {
        throw new TestNotFoundResponse(TestNotFoundResponseCode.Fatal);
      } else {
        const val = input;
        activityContext.exit();
        return val;
      }
    } else {
      throw new Error("Invalid.");
    }
  }

  public async op12(): Promise<Uint8Array> {
    const activityContext = IModelActivityContext.createForCurrentRpcRequest(this).enter();
    const val = testInterfaceResource();
    activityContext.exit();
    return val;
  }

  public async op13(data: Uint8Array): Promise<void> {
    const activityContext = IModelActivityContext.createForCurrentRpcRequest(this).enter();
    if (data[0] === 1 && data[1] === 2 && data[2] === 3 && data[3] === 4) {
      activityContext.exit();
      return;
    } else {
      throw new Error();
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
    const activityContext = IModelActivityContext.createForCurrentRpcRequest(this).enter();
    const val = input;
    activityContext.exit();
    return val;
  }
}

export class TestRpcImpl3 extends RpcInterface implements TestRpcInterface3 {
  public static register() {
    RpcManager.registerImpl(TestRpcInterface3, TestRpcImpl3);
  }

  public async op1(input: number): Promise<number> {
    const activityContext = IModelActivityContext.createForCurrentRpcRequest(this).enter();
    const val = input;
    activityContext.exit();
    return val;
  }
}
