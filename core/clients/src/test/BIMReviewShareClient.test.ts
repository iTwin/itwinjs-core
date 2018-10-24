/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { AuthorizationToken, AccessToken } from "../Token";
import { TestConfig } from "./TestConfig";
import { BIMReviewShareClient, Content } from "../BIMReviewShareClient";
import { ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core";

describe("BIMReviewShareClient", () => {

  let accessToken: AccessToken;
  let actx: ActivityLoggingContext;
  const bimReviewShareClient: BIMReviewShareClient = new BIMReviewShareClient();
  let projectId: string = "";
  const moduleName = "BIMREVIEWSHARE_TEST_SavedViewsModule";

  before(async function (this: Mocha.IHookCallbackContext) {
    this.enableTimeouts(false);
    actx = new ActivityLoggingContext("");
    if (TestConfig.enableMocks)
      return;

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const authToken: AuthorizationToken = await TestConfig.login();
    accessToken = await bimReviewShareClient.getAccessToken(actx, authToken);

    const testCase = await TestConfig.queryTestCase(accessToken, TestConfig.projectName);
    projectId = testCase.project.wsgId;

    // Try to pre-emptively clean-up instances that may have stayed in the service after a failed run of this test
    try {
      const content: Content[] = await bimReviewShareClient.getContentInstances(actx, accessToken, projectId, moduleName);
      if (content.length !== 0) {
        for (const currentContent of content)
          await bimReviewShareClient.deleteContentInstance(actx, accessToken, currentContent);
      }
    } catch (e) {

    }
  });

  it.only("should be able to post, retrieve, update and delete Content instance and data (#integration)", async function (this: Mocha.ITestCallbackContext) {
    // Test with fabricated "User ID"
    const userGuidTest = Guid.createValue();
    const userGuidTest2 = Guid.createValue();
    // Test data to post in content's blob data
    let testData = { varA: 1, varB: 2, str1: "Test1", str2: "Test2" };
    // Post content using a randomly generated user GUIDs
    await bimReviewShareClient.postContent(actx, accessToken, "Test Filter", "All Classes", moduleName, "1.0.0", "Saved View Test 1", userGuidTest.toString(), projectId, testData);
    await bimReviewShareClient.postContent(actx, accessToken, "Test Filter", "All Classes", moduleName, "1.0.0", "Saved View Test 2", userGuidTest2.toString(), projectId, testData);
    // Obtain content afterwards for the project
    // Test that we can get content for the saved views
    let content: Content[] = await bimReviewShareClient.getContentInstances(actx, accessToken, projectId, moduleName);
    // Make sure we get both posted contents
    chai.assert(content.length === 2);
    // Test we can get the content for a specific user
    const contentFromUser: Content[] = await bimReviewShareClient.getContentInstances(actx, accessToken, projectId, moduleName, userGuidTest.toString());
    // We should get only one related to this random GUID user and it should have the right owner
    chai.assert(contentFromUser.length === 1);
    chai.assert(contentFromUser[0].owner === userGuidTest.toString());
    // Get the posted test data
    let data: any = await bimReviewShareClient.getContentData(actx, accessToken, contentFromUser[0].wsgId);
    // Compare returned data
    chai.assert(data.varA === testData.varA);
    chai.assert(data.varB === testData.varB);
    chai.assert(data.str1 === testData.str1);
    chai.assert(data.str2 === testData.str2);
    // Try updating the instance with new data
    testData = { varA: 3, varB: 2, str1: "Test5", str2: "Test9" };
    // Update content call
    await bimReviewShareClient.updateContent(actx, accessToken, contentFromUser[0], testData);
    // Retrieve data again
    data = await bimReviewShareClient.getContentData(actx, accessToken, contentFromUser[0].wsgId);
    chai.assert(data.varA === testData.varA);
    chai.assert(data.varB === testData.varB);
    chai.assert(data.str1 === testData.str1);
    chai.assert(data.str2 === testData.str2);
    // Clean-up and test deleting instances
    for (const currentContent of content)
      await bimReviewShareClient.deleteContentInstance(actx, accessToken, currentContent);
    // Get the content instances again to make sure they were deleted
    content = await bimReviewShareClient.getContentInstances(actx, accessToken, projectId, moduleName);
    chai.assert(content.length === 0);
    // Make sure the data is also gone and that we get an empty object back
    try {
      // This should fail
      data = await bimReviewShareClient.getContentData(actx, accessToken, contentFromUser[0].wsgId);
      // Shouldn't get here
      chai.assert(false);
    } catch (e) {
      // Should go through here, causing a 'Not Found' error
      data = {};
    }
  });
});
