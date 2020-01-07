/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { FrontstageManager } from "../../ui-framework/frontstage/FrontstageManager";
import { ContentLayoutManager } from "../../ui-framework/content/ContentLayoutManager";

describe("ContentLayoutManager", () => {
  before(async () => {
    await FrontstageManager.setActiveFrontstageDef(undefined);
  });

  it("activeLayout should return undefined if no active frontstage", () => {
    expect(ContentLayoutManager.activeLayout).to.be.undefined;
  });

  it("activeContentGroup should return undefined if no active frontstage", () => {
    expect(ContentLayoutManager.activeContentGroup).to.be.undefined;
  });

  it("refreshActiveLayout should do nothing if no active frontstage", () => {
    ContentLayoutManager.refreshActiveLayout();
  });

});
