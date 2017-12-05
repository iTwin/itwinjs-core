"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const TestbedConfig_1 = require("../common/TestbedConfig");
const chai_1 = require("chai");
describe("Testbed Server", () => {
    it("should serve swagger.json", () => {
        const info = TestbedConfig_1.TestbedConfig.gatewayParams.info;
        const req = new XMLHttpRequest();
        req.open("GET", `http://localhost:${TestbedConfig_1.TestbedConfig.serverPort}${TestbedConfig_1.TestbedConfig.swaggerURI}`, false);
        req.send();
        const desc = JSON.parse(req.responseText);
        chai_1.assert(desc.info.title === info.title && desc.info.version === info.version);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVGVzdGJlZFNlcnZlci50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vVGVzdGJlZFNlcnZlci50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7O2dHQUVnRztBQUNoRywyREFBd0Q7QUFDeEQsK0JBQThCO0FBRTlCLFFBQVEsQ0FBQyxnQkFBZ0IsRUFBRSxHQUFHLEVBQUU7SUFDOUIsRUFBRSxDQUFDLDJCQUEyQixFQUFFLEdBQUcsRUFBRTtRQUNuQyxNQUFNLElBQUksR0FBRyw2QkFBYSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUM7UUFDOUMsTUFBTSxHQUFHLEdBQUcsSUFBSSxjQUFjLEVBQUUsQ0FBQztRQUNqQyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxvQkFBb0IsNkJBQWEsQ0FBQyxVQUFVLEdBQUcsNkJBQWEsQ0FBQyxVQUFVLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNsRyxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDWCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUMxQyxhQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEtBQUssSUFBSSxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sS0FBSyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDL0UsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbnwgICRDb3B5cmlnaHQ6IChjKSAyMDE3IEJlbnRsZXkgU3lzdGVtcywgSW5jb3Jwb3JhdGVkLiBBbGwgcmlnaHRzIHJlc2VydmVkLiAkXHJcbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xyXG5pbXBvcnQgeyBUZXN0YmVkQ29uZmlnIH0gZnJvbSBcIi4uL2NvbW1vbi9UZXN0YmVkQ29uZmlnXCI7XHJcbmltcG9ydCB7IGFzc2VydCB9IGZyb20gXCJjaGFpXCI7XHJcblxyXG5kZXNjcmliZShcIlRlc3RiZWQgU2VydmVyXCIsICgpID0+IHtcclxuICBpdChcInNob3VsZCBzZXJ2ZSBzd2FnZ2VyLmpzb25cIiwgKCkgPT4ge1xyXG4gICAgY29uc3QgaW5mbyA9IFRlc3RiZWRDb25maWcuZ2F0ZXdheVBhcmFtcy5pbmZvO1xyXG4gICAgY29uc3QgcmVxID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XHJcbiAgICByZXEub3BlbihcIkdFVFwiLCBgaHR0cDovL2xvY2FsaG9zdDoke1Rlc3RiZWRDb25maWcuc2VydmVyUG9ydH0ke1Rlc3RiZWRDb25maWcuc3dhZ2dlclVSSX1gLCBmYWxzZSk7XHJcbiAgICByZXEuc2VuZCgpO1xyXG4gICAgY29uc3QgZGVzYyA9IEpTT04ucGFyc2UocmVxLnJlc3BvbnNlVGV4dCk7XHJcbiAgICBhc3NlcnQoZGVzYy5pbmZvLnRpdGxlID09PSBpbmZvLnRpdGxlICYmIGRlc2MuaW5mby52ZXJzaW9uID09PSBpbmZvLnZlcnNpb24pO1xyXG4gIH0pO1xyXG59KTtcclxuIl19