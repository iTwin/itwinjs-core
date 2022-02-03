/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { SnapshotDb } from "@itwin/core-backend";
import { HierarchyCacheMode, PresentationManagerMode } from "@itwin/presentation-backend";
import type { NativePlatformDefinition } from "@itwin/presentation-backend/lib/cjs/presentation-backend/NativePlatform";
import { createDefaultNativePlatform } from "@itwin/presentation-backend/lib/cjs/presentation-backend/NativePlatform";
import { PresentationError } from "@itwin/presentation-common";
import { initialize, terminate } from "../IntegrationTests";

describe("NativePlatform", () => {

  let nativePlatform: NativePlatformDefinition;
  let imodel: SnapshotDb;

  before(async () => {
    await initialize();
  });

  after(async () => {
    await terminate();
  });

  beforeEach(() => {
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = SnapshotDb.openFile(testIModelName);
    expect(imodel).is.not.null;
    const TNativePlatform = createDefaultNativePlatform({ // eslint-disable-line @typescript-eslint/naming-convention
      id: "",
      localeDirectories: [],
      taskAllocationsMap: {},
      mode: PresentationManagerMode.ReadWrite,
      isChangeTrackingEnabled: false,
      cacheConfig: { mode: HierarchyCacheMode.Memory },
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
    await expect(nativePlatform.handleRequest(db, "")).to.eventually.be.rejectedWith(PresentationError, "request");
  });

  it("throws on empty request id", async () => {
    const db = nativePlatform.getImodelAddon(imodel);
    await expect(nativePlatform.handleRequest(db, JSON.stringify({ requestId: "" }))).to.eventually.be.rejectedWith(PresentationError, "request.requestId");
  });

  it("throws on not handled request id", async () => {
    const db = nativePlatform.getImodelAddon(imodel);
    await expect(nativePlatform.handleRequest(db, JSON.stringify({ requestId: "Unknown" }))).to.eventually.be.rejectedWith(PresentationError, "request.requestId");
  });

});
