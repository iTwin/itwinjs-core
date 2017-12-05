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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiR2F0ZXdheS50bXAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9HYXRld2F5LnRtcC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBOztnR0FFZ0c7QUFDaEcsdURBQW1FO0FBQ25FLCtCQUE4QjtBQUU5QixRQUFRLENBQUMsU0FBUyxFQUFFLEdBQUcsRUFBRTtJQUN2QixFQUFFLENBQUMscUNBQXFDLEVBQUUsS0FBSyxJQUFJLEVBQUU7UUFDbkQsTUFBTSxNQUFNLEdBQUcsSUFBSSwyQkFBYSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUN2QyxNQUFNLFNBQVMsR0FBRyxNQUFNLHlCQUFXLENBQUMsUUFBUSxFQUFFLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzNELGFBQU0sQ0FBQyxLQUFLLENBQUUsU0FBUyxFQUFFLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ3pDLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG58ICAkQ29weXJpZ2h0OiAoYykgMjAxNyBCZW50bGV5IFN5c3RlbXMsIEluY29ycG9yYXRlZC4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gJFxyXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cclxuaW1wb3J0IHsgVGVzdEdhdGV3YXksIFRlc3RPcDFQYXJhbXMgfSBmcm9tIFwiLi4vY29tbW9uL1Rlc3RHYXRld2F5XCI7XHJcbmltcG9ydCB7IGFzc2VydCB9IGZyb20gXCJjaGFpXCI7XHJcblxyXG5kZXNjcmliZShcIkdhdGV3YXlcIiwgKCkgPT4ge1xyXG4gIGl0KFwic2hvdWxkIG1hcnNoYWxsIHR5cGVzIG92ZXIgdGhlIHdpcmVcIiwgYXN5bmMgKCkgPT4ge1xyXG4gICAgY29uc3QgcGFyYW1zID0gbmV3IFRlc3RPcDFQYXJhbXMoMSwgMSk7XHJcbiAgICBjb25zdCByZW1vdGVTdW0gPSBhd2FpdCBUZXN0R2F0ZXdheS5nZXRQcm94eSgpLm9wMShwYXJhbXMpO1xyXG4gICAgYXNzZXJ0LmVxdWFsIChyZW1vdGVTdW0sIHBhcmFtcy5zdW0oKSk7XHJcbiAgfSk7XHJcbn0pO1xyXG4iXX0=