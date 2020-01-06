/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { ClientsLoggerCategory } from "@bentley/imodeljs-clients";
import { ClientsBackendLoggerCategory } from "../ClientsBackendLoggerCategory";

describe("ClientsBackendLoggerCategory", () => {
  it("names should be consistent", async () => {
    chai.expect(ClientsBackendLoggerCategory.IModelHub).equals(ClientsLoggerCategory.IModelHub);
  });
});
