"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const Gateway_1 = require("../../../../backend/lib/common/Gateway");
class TestOp1Params {
    constructor(a, b) {
        this.a = a;
        this.b = b;
    }
    sum() {
        return this.a + this.b;
    }
}
exports.TestOp1Params = TestOp1Params;
class TestGateway extends Gateway_1.Gateway {
    static getProxy() {
        return Gateway_1.Gateway.getProxyForGateway(TestGateway);
    }
    async op1(_params) {
        return this.forward.apply(this, arguments);
    }
}
TestGateway.version = "1.0.0";
exports.TestGateway = TestGateway;
//# sourceMappingURL=TestGateway.js.map