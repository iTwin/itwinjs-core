"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const IModelGateway_1 = require("../../../../frontend/lib/gateway/IModelGateway");
const chai_1 = require("chai");
describe("IModelGateway", () => {
    it("openStandalone should handle a blank filename", async () => {
        try {
            await IModelGateway_1.IModelGateway.getProxy().openStandalone("", 1 /* Readonly */);
            chai_1.assert(false);
        }
        catch (e) {
            chai_1.assert(e.message.indexOf("DbResult.BE_SQLITE_NOTFOUND") !== -1);
        }
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSU1vZGVsR2F0ZXdheS50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vSU1vZGVsR2F0ZXdheS50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7O2dHQUVnRztBQUNoRyx1RUFBb0U7QUFFcEUsK0JBQThCO0FBRTlCLFFBQVEsQ0FBQyxlQUFlLEVBQUUsR0FBRyxFQUFFO0lBQzdCLEVBQUUsQ0FBQywrQ0FBK0MsRUFBRSxLQUFLLElBQUksRUFBRTtRQUM3RCxJQUFJLENBQUM7WUFDSCxNQUFNLDZCQUFhLENBQUMsUUFBUSxFQUFFLENBQUMsY0FBYyxDQUFDLEVBQUUsbUJBQW9CLENBQUM7WUFDckUsYUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2hCLENBQUM7UUFBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ1gsYUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLDZCQUE2QixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNsRSxDQUFDO0lBQ0gsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbnwgICRDb3B5cmlnaHQ6IChjKSAyMDE3IEJlbnRsZXkgU3lzdGVtcywgSW5jb3Jwb3JhdGVkLiBBbGwgcmlnaHRzIHJlc2VydmVkLiAkXHJcbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xyXG5pbXBvcnQgeyBJTW9kZWxHYXRld2F5IH0gZnJvbSBcIiQoY29tbW9uKS9saWIvZ2F0ZXdheS9JTW9kZWxHYXRld2F5XCI7XHJcbmltcG9ydCB7IE9wZW5Nb2RlIH0gZnJvbSBcIkBiZW50bGV5L2JlbnRsZXlqcy1jb3JlL2xpYi9CZVNRTGl0ZVwiO1xyXG5pbXBvcnQgeyBhc3NlcnQgfSBmcm9tIFwiY2hhaVwiO1xyXG5cclxuZGVzY3JpYmUoXCJJTW9kZWxHYXRld2F5XCIsICgpID0+IHtcclxuICBpdChcIm9wZW5TdGFuZGFsb25lIHNob3VsZCBoYW5kbGUgYSBibGFuayBmaWxlbmFtZVwiLCBhc3luYyAoKSA9PiB7XHJcbiAgICB0cnkge1xyXG4gICAgICBhd2FpdCBJTW9kZWxHYXRld2F5LmdldFByb3h5KCkub3BlblN0YW5kYWxvbmUoXCJcIiwgT3Blbk1vZGUuUmVhZG9ubHkpO1xyXG4gICAgICBhc3NlcnQoZmFsc2UpO1xyXG4gICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICBhc3NlcnQoZS5tZXNzYWdlLmluZGV4T2YoXCJEYlJlc3VsdC5CRV9TUUxJVEVfTk9URk9VTkRcIikgIT09IC0xKTtcclxuICAgIH1cclxuICB9KTtcclxufSk7XHJcbiJdfQ==