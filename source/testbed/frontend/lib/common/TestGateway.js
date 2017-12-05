"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const Gateway_1 = require("../../../../frontend/lib/common/Gateway");
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVGVzdEdhdGV3YXkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9jb21tb24vVGVzdEdhdGV3YXkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7Z0dBRWdHO0FBQ2hHLDBEQUF1RDtBQUV2RDtJQUlFLFlBQVksQ0FBUyxFQUFFLENBQVM7UUFDOUIsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDWCxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNiLENBQUM7SUFFTSxHQUFHO1FBQ1IsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUN6QixDQUFDO0NBQ0Y7QUFaRCxzQ0FZQztBQUVELGlCQUFrQyxTQUFRLGlCQUFPO0lBR3hDLE1BQU0sQ0FBQyxRQUFRO1FBQ3BCLE1BQU0sQ0FBQyxpQkFBTyxDQUFDLGtCQUFrQixDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ2pELENBQUM7SUFFTSxLQUFLLENBQUMsR0FBRyxDQUFDLE9BQXNCO1FBQ3JDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDN0MsQ0FBQzs7QUFSYSxtQkFBTyxHQUFHLE9BQU8sQ0FBQztBQURsQyxrQ0FVQyIsInNvdXJjZXNDb250ZW50IjpbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbnwgICRDb3B5cmlnaHQ6IChjKSAyMDE3IEJlbnRsZXkgU3lzdGVtcywgSW5jb3Jwb3JhdGVkLiBBbGwgcmlnaHRzIHJlc2VydmVkLiAkXHJcbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xyXG5pbXBvcnQgeyBHYXRld2F5IH0gZnJvbSBcIiQoY29tbW9uKS9saWIvY29tbW9uL0dhdGV3YXlcIjtcclxuXHJcbmV4cG9ydCBjbGFzcyBUZXN0T3AxUGFyYW1zIHtcclxuICBwdWJsaWMgYTogbnVtYmVyO1xyXG4gIHB1YmxpYyBiOiBudW1iZXI7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGE6IG51bWJlciwgYjogbnVtYmVyKSB7XHJcbiAgICB0aGlzLmEgPSBhO1xyXG4gICAgdGhpcy5iID0gYjtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBzdW0oKSB7XHJcbiAgICByZXR1cm4gdGhpcy5hICsgdGhpcy5iO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFRlc3RHYXRld2F5IGV4dGVuZHMgR2F0ZXdheSB7XHJcbiAgcHVibGljIHN0YXRpYyB2ZXJzaW9uID0gXCIxLjAuMFwiO1xyXG5cclxuICBwdWJsaWMgc3RhdGljIGdldFByb3h5KCk6IFRlc3RHYXRld2F5IHtcclxuICAgIHJldHVybiBHYXRld2F5LmdldFByb3h5Rm9yR2F0ZXdheShUZXN0R2F0ZXdheSk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgYXN5bmMgb3AxKF9wYXJhbXM6IFRlc3RPcDFQYXJhbXMpOiBQcm9taXNlPG51bWJlcj4ge1xyXG4gICAgcmV0dXJuIHRoaXMuZm9yd2FyZC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG4gIH1cclxufVxyXG4iXX0=