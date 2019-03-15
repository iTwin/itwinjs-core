/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { IModelDb } from "@bentley/imodeljs-backend";
import { PresentationError } from "@bentley/presentation-common";
import { NativePlatformDefinition, createDefaultNativePlatform } from "@bentley/presentation-backend/lib/NativePlatform";
import { initialize, terminate } from "../IntegrationTests";

describe("NativePlatform", () => {

  let nativePlatform: NativePlatformDefinition;
  let imodel: IModelDb;

  before(() => {
    initialize();
  });

  after(() => {
    terminate();
  });

  beforeEach(() => {
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = IModelDb.openSnapshot(testIModelName);
    expect(imodel).is.not.null;
    const TNativePlatform = createDefaultNativePlatform(); // tslint:disable-line: variable-name naming-convention
    nativePlatform = new TNativePlatform();
  });

  afterEach(() => {
    nativePlatform.dispose();
    try {
      imodel.closeSnapshot();
    } catch (_e) { }
  });

  it("throws on closed imodel", async () => {
    imodel.closeSnapshot();
    expect(() => nativePlatform.getImodelAddon(imodel)).to.throw(PresentationError);
  });

  it("throws on empty options", async () => {
    const db = nativePlatform.getImodelAddon(imodel);
    // tslint:disable-next-line:await-promise
    await expect(nativePlatform.handleRequest(ClientRequestContext.current, db, "")).to.eventually.be.rejectedWith(PresentationError, "request");
  });

  it("throws on empty request id", async () => {
    const db = nativePlatform.getImodelAddon(imodel);
    // tslint:disable-next-line:await-promise
    await expect(nativePlatform.handleRequest(ClientRequestContext.current, db, JSON.stringify({ requestId: "" }))).to.eventually.be.rejectedWith(PresentationError, "request.requestId");
  });

  it("throws on not handled request id", async () => {
    const db = nativePlatform.getImodelAddon(imodel);
    // tslint:disable-next-line:await-promise
    await expect(nativePlatform.handleRequest(ClientRequestContext.current, db, JSON.stringify({ requestId: "Unknown" }))).to.eventually.be.rejectedWith(PresentationError, "request.requestId");
  });

});
