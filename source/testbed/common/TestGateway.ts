/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway } from "../../common/Gateway";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";

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

export abstract class TestGateway extends Gateway {
  public static version = "1.0.0";

  public static types = () => [
    TestOp1Params,
    Id64,
    Date,
  ]

  public static getProxy(): TestGateway {
    return Gateway.getProxyForGateway(TestGateway);
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
}
