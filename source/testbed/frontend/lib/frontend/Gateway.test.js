"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const TestGateway_1 = require("../common/TestGateway");
const chai_1 = require("chai");
describe("Gateway", () => {
    it("should marshall types over the wire", async () => {
        const params = new TestGateway_1.TestOp1Params(1, 1);
        const remoteSum = await TestGateway_1.TestGateway.getProxy().op1(params);
        chai_1.assert.equal(remoteSum, params.sum());
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiR2F0ZXdheS50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vR2F0ZXdheS50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7O2dHQUVnRztBQUNoRyx1REFBbUU7QUFDbkUsK0JBQThCO0FBRTlCLFFBQVEsQ0FBQyxTQUFTLEVBQUUsR0FBRyxFQUFFO0lBQ3ZCLEVBQUUsQ0FBQyxxQ0FBcUMsRUFBRSxLQUFLLElBQUksRUFBRTtRQUNuRCxNQUFNLE1BQU0sR0FBRyxJQUFJLDJCQUFhLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3ZDLE1BQU0sU0FBUyxHQUFHLE1BQU0seUJBQVcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDM0QsYUFBTSxDQUFDLEtBQUssQ0FBRSxTQUFTLEVBQUUsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDekMsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbnwgICRDb3B5cmlnaHQ6IChjKSAyMDE3IEJlbnRsZXkgU3lzdGVtcywgSW5jb3Jwb3JhdGVkLiBBbGwgcmlnaHRzIHJlc2VydmVkLiAkXHJcbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xyXG5pbXBvcnQgeyBUZXN0R2F0ZXdheSwgVGVzdE9wMVBhcmFtcyB9IGZyb20gXCIuLi9jb21tb24vVGVzdEdhdGV3YXlcIjtcclxuaW1wb3J0IHsgYXNzZXJ0IH0gZnJvbSBcImNoYWlcIjtcclxuXHJcbmRlc2NyaWJlKFwiR2F0ZXdheVwiLCAoKSA9PiB7XHJcbiAgaXQoXCJzaG91bGQgbWFyc2hhbGwgdHlwZXMgb3ZlciB0aGUgd2lyZVwiLCBhc3luYyAoKSA9PiB7XHJcbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgVGVzdE9wMVBhcmFtcygxLCAxKTtcclxuICAgIGNvbnN0IHJlbW90ZVN1bSA9IGF3YWl0IFRlc3RHYXRld2F5LmdldFByb3h5KCkub3AxKHBhcmFtcyk7XHJcbiAgICBhc3NlcnQuZXF1YWwgKHJlbW90ZVN1bSwgcGFyYW1zLnN1bSgpKTtcclxuICB9KTtcclxufSk7XHJcbiJdfQ==