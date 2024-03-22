/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { CloudSqlite } from "../../CloudSqlite";
import { IModelDb } from "../../IModelDb";

describe("IModelDb.Views", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("accessViewStore", () => {
    it("forwards requestToken and accessLevel to CloudSqlite", async () => {
      const requestTokenStub = sinon.stub(CloudSqlite, "requestToken").throws("test_exception");
      const views = new IModelDb.Views({ queryFilePropertyString: () => "{}" } as unknown as IModelDb);
      await expect(
        views.accessViewStore({ userToken: "test_token", accessLevel: "writeIfPossible" }),
      ).to.be.rejectedWith("test_exception");
      expect(
        requestTokenStub.firstCall.calledWith({ userToken: "test_token", accessLevel: "writeIfPossible" }),
      ).to.be.true;
    });
  });
});
