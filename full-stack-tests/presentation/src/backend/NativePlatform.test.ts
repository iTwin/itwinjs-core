/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { SnapshotDb } from "@bentley/imodeljs-backend";
import { PresentationManagerMode } from "@bentley/presentation-backend";
import { createDefaultNativePlatform, NativePlatformDefinition } from "@bentley/presentation-backend/lib/presentation-backend/NativePlatform";
import { PresentationError } from "@bentley/presentation-common";
import { expect } from "chai";
import { initialize, terminate } from "../IntegrationTests";

describe("NativePlatform", () => {

  let nativePlatform: NativePlatformDefinition;
  let imodel: SnapshotDb;

  before(async () => {
    await initialize();
  });

  after(() => {
    terminate();
  });

  beforeEach(() => {
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = SnapshotDb.open(testIModelName);
    expect(imodel).is.not.null;
    const TNativePlatform = createDefaultNativePlatform({ // tslint:disable-line: variable-name naming-convention
      id: "",
      localeDirectories: [],
      taskAllocationsMap: {},
      mode: PresentationManagerMode.ReadWrite,
    });
    nativePlatform = new TNativePlatform();
  });

  afterEach(() => {
    nativePlatform.dispose();
    try {
      imodel.close();
    } catch (_e) { }
  });

  it("throws on closed imodel", async () => {
    imodel.close();
    expect(() => nativePlatform.getImodelAddon(imodel)).to.throw(Error);
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
