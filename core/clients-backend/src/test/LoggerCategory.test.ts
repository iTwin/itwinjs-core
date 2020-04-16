/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { ClientsBackendLoggerCategory } from "../ClientsBackendLoggerCategory";
import { IModelHubClientLoggerCategory } from "@bentley/imodelhub-client";

describe("ClientsBackendLoggerCategory", () => {
  it("names should be consistent", async () => {
    chai.expect(ClientsBackendLoggerCategory.IModelHub).equals(IModelHubClientLoggerCategory.IModelHub);
  });
});
