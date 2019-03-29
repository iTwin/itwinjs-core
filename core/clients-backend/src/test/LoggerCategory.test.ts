/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { LoggerCategory as ClientsLoggerCategory } from "@bentley/imodeljs-clients";
import { LoggerCategory as ClientsBackendLoggerCategory } from "../LoggerCategory";

describe.only("LoggerCategory", () => {
  it("names should be consistent", async () => {
    chai.expect(ClientsBackendLoggerCategory.IModelHub).equals(ClientsLoggerCategory.IModelHub);
  });
});
