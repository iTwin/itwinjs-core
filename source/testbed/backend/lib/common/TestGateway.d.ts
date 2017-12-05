import { Gateway } from "../../../../backend/lib/common/Gateway";
export declare class TestOp1Params {
    a: number;
    b: number;
    constructor(a: number, b: number);
    sum(): number;
}
export declare abstract class TestGateway extends Gateway {
    static version: string;
    static getProxy(): TestGateway;
    op1(_params: TestOp1Params): Promise<number>;
}
