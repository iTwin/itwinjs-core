"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const IModelGateway_1 = require("../../../frontend/lib/gateway/IModelGateway");
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSU1vZGVsR2F0ZXdheS50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vZnJvbnRlbmQvSU1vZGVsR2F0ZXdheS50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7O2dHQUVnRztBQUNoRyx5RUFBc0U7QUFFdEUsK0JBQThCO0FBRTlCLFFBQVEsQ0FBQyxlQUFlLEVBQUUsR0FBRyxFQUFFO0lBQzdCLEVBQUUsQ0FBQywrQ0FBK0MsRUFBRSxLQUFLLElBQUksRUFBRTtRQUM3RCxJQUFJLENBQUM7WUFDSCxNQUFNLDZCQUFhLENBQUMsUUFBUSxFQUFFLENBQUMsY0FBYyxDQUFDLEVBQUUsbUJBQW9CLENBQUM7WUFDckUsYUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2hCLENBQUM7UUFBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ1gsYUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLDZCQUE2QixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNsRSxDQUFDO0lBQ0gsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbnwgICRDb3B5cmlnaHQ6IChjKSAyMDE3IEJlbnRsZXkgU3lzdGVtcywgSW5jb3Jwb3JhdGVkLiBBbGwgcmlnaHRzIHJlc2VydmVkLiAkXHJcbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xyXG5pbXBvcnQgeyBJTW9kZWxHYXRld2F5IH0gZnJvbSBcIiQoZnJvbnRlbmQpL2xpYi9nYXRld2F5L0lNb2RlbEdhdGV3YXlcIjtcclxuaW1wb3J0IHsgT3Blbk1vZGUgfSBmcm9tIFwiQGJlbnRsZXkvYmVudGxleWpzLWNvcmUvbGliL0JlU1FMaXRlXCI7XHJcbmltcG9ydCB7IGFzc2VydCB9IGZyb20gXCJjaGFpXCI7XHJcblxyXG5kZXNjcmliZShcIklNb2RlbEdhdGV3YXlcIiwgKCkgPT4ge1xyXG4gIGl0KFwib3BlblN0YW5kYWxvbmUgc2hvdWxkIGhhbmRsZSBhIGJsYW5rIGZpbGVuYW1lXCIsIGFzeW5jICgpID0+IHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGF3YWl0IElNb2RlbEdhdGV3YXkuZ2V0UHJveHkoKS5vcGVuU3RhbmRhbG9uZShcIlwiLCBPcGVuTW9kZS5SZWFkb25seSk7XHJcbiAgICAgIGFzc2VydChmYWxzZSk7XHJcbiAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgIGFzc2VydChlLm1lc3NhZ2UuaW5kZXhPZihcIkRiUmVzdWx0LkJFX1NRTElURV9OT1RGT1VORFwiKSAhPT0gLTEpO1xyXG4gICAgfVxyXG4gIH0pO1xyXG59KTtcclxuIl19