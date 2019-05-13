/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { ClientsLoggerCategory } from "@bentley/imodeljs-clients";
import { ClientsBackendLoggerCategory } from "../ClientsBackendLoggerCategory";

describe("ClientsBackendLoggerCategory", () => {
  it("names should be consistent", async () => {
    chai.expect(ClientsBackendLoggerCategory.IModelHub).equals(ClientsLoggerCategory.IModelHub);
  });
});
