"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const chai_1 = require("chai");
const imodeljs_clients_1 = require("@bentley/imodeljs-clients");
const imodeljs_clients_2 = require("@bentley/imodeljs-clients");
class TestData {
    static async getTestUserAccessToken() {
        const authToken = await (new imodeljs_clients_1.ImsActiveSecureTokenClient("QA")).getToken(TestData.user.email, TestData.user.password);
        chai_1.assert(authToken);
        const accessToken = await (new imodeljs_clients_1.ImsDelegationSecureTokenClient("QA")).getToken(authToken);
        chai_1.assert(accessToken);
        return accessToken;
    }
    static async getTestProjectId(accessToken, projectName) {
        const project = await TestData.connectClient.getProject(accessToken, {
            $select: "*",
            $filter: "Name+eq+'" + projectName + "'",
        });
        chai_1.assert(project && project.wsgId);
        return project.wsgId;
    }
    static async getTestIModelId(accessToken, projectId, iModelName) {
        const iModels = await TestData.hubClient.getIModels(accessToken, projectId, {
            $select: "*",
            $filter: "Name+eq+'" + iModelName + "'",
        });
        chai_1.assert(iModels.length > 0);
        chai_1.assert(iModels[0].wsgId);
        return iModels[0].wsgId;
    }
}
TestData.user = {
    email: "bistroDEV_pmadm1@mailinator.com",
    password: "pmadm1",
};
TestData.connectClient = new imodeljs_clients_2.ConnectClient("QA");
TestData.hubClient = new imodeljs_clients_2.IModelHubClient("QA");
exports.TestData = TestData;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVGVzdERhdGEuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9UZXN0RGF0YS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBOztnR0FFZ0c7QUFDaEcsK0JBQThCO0FBQzlCLGdFQUF3STtBQUN4SSxnRUFBb0Y7QUFFcEY7SUFTUyxNQUFNLENBQUMsS0FBSyxDQUFDLHNCQUFzQjtRQUN4QyxNQUFNLFNBQVMsR0FBdUIsTUFBTSxDQUFDLElBQUksNkNBQTBCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN6SSxhQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFbEIsTUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLElBQUksaURBQThCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBVSxDQUFDLENBQUM7UUFDMUYsYUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRXBCLE1BQU0sQ0FBQyxXQUFXLENBQUM7SUFDckIsQ0FBQztJQUVNLE1BQU0sQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLENBQUMsV0FBd0IsRUFBRSxXQUFtQjtRQUNoRixNQUFNLE9BQU8sR0FBWSxNQUFNLFFBQVEsQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLFdBQVcsRUFBRTtZQUM1RSxPQUFPLEVBQUUsR0FBRztZQUNaLE9BQU8sRUFBRSxXQUFXLEdBQUcsV0FBVyxHQUFHLEdBQUc7U0FDekMsQ0FBQyxDQUFDO1FBQ0gsYUFBTSxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDakMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUM7SUFDdkIsQ0FBQztJQUVNLE1BQU0sQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLFdBQXdCLEVBQUUsU0FBaUIsRUFBRSxVQUFrQjtRQUNqRyxNQUFNLE9BQU8sR0FBRyxNQUFNLFFBQVEsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFdBQVcsRUFBRSxTQUFTLEVBQUU7WUFDMUUsT0FBTyxFQUFFLEdBQUc7WUFDWixPQUFPLEVBQUUsV0FBVyxHQUFHLFVBQVUsR0FBRyxHQUFHO1NBQ3hDLENBQUMsQ0FBQztRQUNILGFBQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQzNCLGFBQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFekIsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUM7SUFDMUIsQ0FBQzs7QUFwQ2EsYUFBSSxHQUFHO0lBQ25CLEtBQUssRUFBRSxpQ0FBaUM7SUFDeEMsUUFBUSxFQUFFLFFBQVE7Q0FDbkIsQ0FBQztBQUVZLHNCQUFhLEdBQUcsSUFBSSxnQ0FBYSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3hDLGtCQUFTLEdBQUcsSUFBSSxrQ0FBZSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBUHRELDRCQXNDQyIsInNvdXJjZXNDb250ZW50IjpbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbnwgICRDb3B5cmlnaHQ6IChjKSAyMDE3IEJlbnRsZXkgU3lzdGVtcywgSW5jb3Jwb3JhdGVkLiBBbGwgcmlnaHRzIHJlc2VydmVkLiAkXHJcbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xyXG5pbXBvcnQgeyBhc3NlcnQgfSBmcm9tIFwiY2hhaVwiO1xyXG5pbXBvcnQgeyBBdXRob3JpemF0aW9uVG9rZW4sIEFjY2Vzc1Rva2VuLCBJbXNBY3RpdmVTZWN1cmVUb2tlbkNsaWVudCwgSW1zRGVsZWdhdGlvblNlY3VyZVRva2VuQ2xpZW50IH0gZnJvbSBcIkBiZW50bGV5L2ltb2RlbGpzLWNsaWVudHNcIjtcclxuaW1wb3J0IHsgQ29ubmVjdENsaWVudCwgUHJvamVjdCwgSU1vZGVsSHViQ2xpZW50IH0gZnJvbSBcIkBiZW50bGV5L2ltb2RlbGpzLWNsaWVudHNcIjtcclxuXHJcbmV4cG9ydCBjbGFzcyBUZXN0RGF0YSB7XHJcbiAgcHVibGljIHN0YXRpYyB1c2VyID0ge1xyXG4gICAgZW1haWw6IFwiYmlzdHJvREVWX3BtYWRtMUBtYWlsaW5hdG9yLmNvbVwiLFxyXG4gICAgcGFzc3dvcmQ6IFwicG1hZG0xXCIsXHJcbiAgfTtcclxuXHJcbiAgcHVibGljIHN0YXRpYyBjb25uZWN0Q2xpZW50ID0gbmV3IENvbm5lY3RDbGllbnQoXCJRQVwiKTtcclxuICBwdWJsaWMgc3RhdGljIGh1YkNsaWVudCA9IG5ldyBJTW9kZWxIdWJDbGllbnQoXCJRQVwiKTtcclxuXHJcbiAgcHVibGljIHN0YXRpYyBhc3luYyBnZXRUZXN0VXNlckFjY2Vzc1Rva2VuKCk6IFByb21pc2U8QWNjZXNzVG9rZW4+IHtcclxuICAgIGNvbnN0IGF1dGhUb2tlbjogQXV0aG9yaXphdGlvblRva2VuID0gYXdhaXQgKG5ldyBJbXNBY3RpdmVTZWN1cmVUb2tlbkNsaWVudChcIlFBXCIpKS5nZXRUb2tlbihUZXN0RGF0YS51c2VyLmVtYWlsLCBUZXN0RGF0YS51c2VyLnBhc3N3b3JkKTtcclxuICAgIGFzc2VydChhdXRoVG9rZW4pO1xyXG5cclxuICAgIGNvbnN0IGFjY2Vzc1Rva2VuID0gYXdhaXQgKG5ldyBJbXNEZWxlZ2F0aW9uU2VjdXJlVG9rZW5DbGllbnQoXCJRQVwiKSkuZ2V0VG9rZW4oYXV0aFRva2VuISk7XHJcbiAgICBhc3NlcnQoYWNjZXNzVG9rZW4pO1xyXG5cclxuICAgIHJldHVybiBhY2Nlc3NUb2tlbjtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBzdGF0aWMgYXN5bmMgZ2V0VGVzdFByb2plY3RJZChhY2Nlc3NUb2tlbjogQWNjZXNzVG9rZW4sIHByb2plY3ROYW1lOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xyXG4gICAgY29uc3QgcHJvamVjdDogUHJvamVjdCA9IGF3YWl0IFRlc3REYXRhLmNvbm5lY3RDbGllbnQuZ2V0UHJvamVjdChhY2Nlc3NUb2tlbiwge1xyXG4gICAgICAkc2VsZWN0OiBcIipcIixcclxuICAgICAgJGZpbHRlcjogXCJOYW1lK2VxKydcIiArIHByb2plY3ROYW1lICsgXCInXCIsXHJcbiAgICB9KTtcclxuICAgIGFzc2VydChwcm9qZWN0ICYmIHByb2plY3Qud3NnSWQpO1xyXG4gICAgcmV0dXJuIHByb2plY3Qud3NnSWQ7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgc3RhdGljIGFzeW5jIGdldFRlc3RJTW9kZWxJZChhY2Nlc3NUb2tlbjogQWNjZXNzVG9rZW4sIHByb2plY3RJZDogc3RyaW5nLCBpTW9kZWxOYW1lOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xyXG4gICAgY29uc3QgaU1vZGVscyA9IGF3YWl0IFRlc3REYXRhLmh1YkNsaWVudC5nZXRJTW9kZWxzKGFjY2Vzc1Rva2VuLCBwcm9qZWN0SWQsIHtcclxuICAgICAgJHNlbGVjdDogXCIqXCIsXHJcbiAgICAgICRmaWx0ZXI6IFwiTmFtZStlcSsnXCIgKyBpTW9kZWxOYW1lICsgXCInXCIsXHJcbiAgICB9KTtcclxuICAgIGFzc2VydChpTW9kZWxzLmxlbmd0aCA+IDApO1xyXG4gICAgYXNzZXJ0KGlNb2RlbHNbMF0ud3NnSWQpO1xyXG5cclxuICAgIHJldHVybiBpTW9kZWxzWzBdLndzZ0lkO1xyXG4gIH1cclxufVxyXG4iXX0=