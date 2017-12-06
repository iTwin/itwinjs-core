"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const testbedConfig = require("../config");
const chai_1 = require("chai");
describe("Testbed Server", () => {
    it("should serve swagger.json", () => {
        const info = testbedConfig.gatewayParams.info;
        const req = new XMLHttpRequest();
        req.open("GET", `http://localhost:${testbedConfig.serverPort}${testbedConfig.swaggerURI}`, false);
        req.send();
        const desc = JSON.parse(req.responseText);
        chai_1.assert(desc.info.title === info.title && desc.info.version === info.version);
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVGVzdGJlZFNlcnZlci50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vZnJvbnRlbmQvVGVzdGJlZFNlcnZlci50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7O2dHQUVnRztBQUNoRywyQ0FBMkM7QUFDM0MsK0JBQThCO0FBRTlCLFFBQVEsQ0FBQyxnQkFBZ0IsRUFBRSxHQUFHLEVBQUU7SUFDOUIsRUFBRSxDQUFDLDJCQUEyQixFQUFFLEdBQUcsRUFBRTtRQUNuQyxNQUFNLElBQUksR0FBRyxhQUFhLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQztRQUM5QyxNQUFNLEdBQUcsR0FBRyxJQUFJLGNBQWMsRUFBRSxDQUFDO1FBQ2pDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLG9CQUFvQixhQUFhLENBQUMsVUFBVSxHQUFHLGFBQWEsQ0FBQyxVQUFVLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUNsRyxHQUFHLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDWCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUMxQyxhQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEtBQUssSUFBSSxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sS0FBSyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDL0UsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbnwgICRDb3B5cmlnaHQ6IChjKSAyMDE3IEJlbnRsZXkgU3lzdGVtcywgSW5jb3Jwb3JhdGVkLiBBbGwgcmlnaHRzIHJlc2VydmVkLiAkXHJcbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xyXG5pbXBvcnQgKiBhcyB0ZXN0YmVkQ29uZmlnIGZyb20gXCIuLi9jb25maWdcIjtcclxuaW1wb3J0IHsgYXNzZXJ0IH0gZnJvbSBcImNoYWlcIjtcclxuXHJcbmRlc2NyaWJlKFwiVGVzdGJlZCBTZXJ2ZXJcIiwgKCkgPT4ge1xyXG4gIGl0KFwic2hvdWxkIHNlcnZlIHN3YWdnZXIuanNvblwiLCAoKSA9PiB7XHJcbiAgICBjb25zdCBpbmZvID0gdGVzdGJlZENvbmZpZy5nYXRld2F5UGFyYW1zLmluZm87XHJcbiAgICBjb25zdCByZXEgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcclxuICAgIHJlcS5vcGVuKFwiR0VUXCIsIGBodHRwOi8vbG9jYWxob3N0OiR7dGVzdGJlZENvbmZpZy5zZXJ2ZXJQb3J0fSR7dGVzdGJlZENvbmZpZy5zd2FnZ2VyVVJJfWAsIGZhbHNlKTtcclxuICAgIHJlcS5zZW5kKCk7XHJcbiAgICBjb25zdCBkZXNjID0gSlNPTi5wYXJzZShyZXEucmVzcG9uc2VUZXh0KTtcclxuICAgIGFzc2VydChkZXNjLmluZm8udGl0bGUgPT09IGluZm8udGl0bGUgJiYgZGVzYy5pbmZvLnZlcnNpb24gPT09IGluZm8udmVyc2lvbik7XHJcbiAgfSk7XHJcbn0pO1xyXG4iXX0=