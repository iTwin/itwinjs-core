/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { TestGateway, TestOp1Params } from "../common/TestGateway";
import { Gateway } from "../../common/Gateway";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";

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
}
