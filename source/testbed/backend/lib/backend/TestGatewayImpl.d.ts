import { TestGateway, TestOp1Params } from "../common/TestGateway";
export declare class TestGatewayImpl extends TestGateway {
    static register(): void;
    op1(params: TestOp1Params): Promise<number>;
}
