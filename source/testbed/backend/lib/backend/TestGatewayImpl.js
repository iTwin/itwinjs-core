"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const TestGateway_1 = require("../common/TestGateway");
const Gateway_1 = require("../../../../backend/lib/common/Gateway");
class TestGatewayImpl extends TestGateway_1.TestGateway {
    static register() {
        Gateway_1.Gateway.registerImplementation(TestGateway_1.TestGateway, TestGatewayImpl);
    }
    async op1(params) {
        return params.sum();
    }
}
exports.TestGatewayImpl = TestGatewayImpl;
//# sourceMappingURL=TestGatewayImpl.js.map