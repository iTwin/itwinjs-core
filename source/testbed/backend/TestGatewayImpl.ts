/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { TestGateway, TestOp1Params } from "../common/TestGateway";
import { Gateway, GatewayRequest, GatewayOperationsProfile, GatewayPendingResponse } from "@bentley/imodeljs-common";
import { Id64 } from "@bentley/bentleyjs-core";

let op8Initializer = 0;

export class TestGatewayImpl extends Gateway implements TestGateway {
  public static register() {
    Gateway.registerImplementation(TestGateway, TestGatewayImpl);
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

  public async op7(): Promise<GatewayOperationsProfile> {
    return GatewayRequest.aggregateLoad;
  }

  public async op8(x: number, y: number): Promise<{ initializer: number; sum: number }> {
    if (!op8Initializer) {
      op8Initializer = TestGateway.OP8_INITIALIZER;
      throw new GatewayPendingResponse(TestGateway.OP8_PENDING_MESSAGE);
    } else {
      return { initializer: op8Initializer, sum: x + y };
    }
  }
}
