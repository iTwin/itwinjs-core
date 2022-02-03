/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import type { ScreenViewport, Viewport } from "@itwin/core-frontend";
import { MockRender } from "@itwin/core-frontend";
import * as moq from "typemoq";
import { HideIsolateEmphasizeActionHandler } from "../../appui-react/selection/HideIsolateEmphasizeManager";
import TestUtils from "../TestUtils";
import { UiFramework } from "../../appui-react/UiFramework";

class TestHideIsolateEmphasizeManager extends HideIsolateEmphasizeActionHandler {
  public featureOverridesActive = false;
  public processIsolateSelectedElementsModelCalled = false;
  public processIsolateSelectedElementsCategoryCalled = false;
  public processIsolateSelectedCalled = false;
  public processHideSelectedElementsModelCalled = false;
  public processHideSelectedElementsCategoryCalled = false;
  public processHideSelectedCalled = false;
  public processEmphasizeSelectedCalled = false;
  public processClearOverrideModelsCalled = false;
  public processClearOverrideCategoriesCalled = false;

  public areFeatureOverridesActive(_vp: Viewport): boolean {
    return this.featureOverridesActive;
  }

  public async processIsolateSelectedElementsModel(): Promise<void> {
    this.processIsolateSelectedElementsModelCalled = true;
    this.featureOverridesActive = true;
  }

  public async processIsolateSelectedElementsCategory(): Promise<void> {
    this.processIsolateSelectedElementsCategoryCalled = true;
    this.featureOverridesActive = true;
  }

  public async processIsolateSelected(): Promise<void> {
    this.processIsolateSelectedCalled = true;
    this.featureOverridesActive = true;
  }

  public async processHideSelectedElementsModel(): Promise<void> {
    this.processHideSelectedElementsModelCalled = true;
    this.featureOverridesActive = true;
  }

  public async processHideSelectedElementsCategory(): Promise<void> {
    this.processHideSelectedElementsCategoryCalled = true;
    this.featureOverridesActive = true;
  }

  public async processHideSelected(): Promise<void> {
    this.processHideSelectedCalled = true;
    this.featureOverridesActive = true;
  }

  public async processEmphasizeSelected(): Promise<void> {
    this.processEmphasizeSelectedCalled = true;
    this.featureOverridesActive = true;
  }

  public async processClearEmphasize(): Promise<void> {
    this.featureOverridesActive = false;
  }

  public async processClearOverrideModels(): Promise<void> {
    this.processClearOverrideModelsCalled = true;
    this.featureOverridesActive = true;
  }

  public async processClearOverrideCategories(): Promise<void> {
    this.processClearOverrideCategoriesCalled = true;
    this.featureOverridesActive = true;
  }
}

describe("Use Custom HideIsolateEmphasizeActionHandler", () => {
  const viewportMock = moq.Mock.ofType<ScreenViewport>();
  const vp = viewportMock.object;

  before(async () => {
    await TestUtils.initializeUiFramework();
    await MockRender.App.startup();
    UiFramework.setHideIsolateEmphasizeActionHandler(new TestHideIsolateEmphasizeManager());
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  it("processEmphasizeSelected", async () => {
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.false;
    await UiFramework.hideIsolateEmphasizeActionHandler.processEmphasizeSelected();
    expect((UiFramework.hideIsolateEmphasizeActionHandler as TestHideIsolateEmphasizeManager).processEmphasizeSelectedCalled).to.be.true;
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.true;
    await UiFramework.hideIsolateEmphasizeActionHandler.processClearEmphasize();
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.false;
  });

  it("processIsolateSelectedElementsModel", async () => {
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.false;
    await UiFramework.hideIsolateEmphasizeActionHandler.processIsolateSelectedElementsModel();
    expect((UiFramework.hideIsolateEmphasizeActionHandler as TestHideIsolateEmphasizeManager).processIsolateSelectedElementsModelCalled).to.be.true;
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.true;
    await UiFramework.hideIsolateEmphasizeActionHandler.processClearEmphasize();
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.false;
  });

  it("processIsolateSelectedElementsCategory", async () => {
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.false;
    await UiFramework.hideIsolateEmphasizeActionHandler.processIsolateSelectedElementsCategory();
    expect((UiFramework.hideIsolateEmphasizeActionHandler as TestHideIsolateEmphasizeManager).processIsolateSelectedElementsCategoryCalled).to.be.true;
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.true;
    await UiFramework.hideIsolateEmphasizeActionHandler.processClearEmphasize();
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.false;
  });

  it("processIsolateSelected", async () => {
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.false;
    await UiFramework.hideIsolateEmphasizeActionHandler.processIsolateSelected();
    expect((UiFramework.hideIsolateEmphasizeActionHandler as TestHideIsolateEmphasizeManager).processIsolateSelectedCalled).to.be.true;
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.true;
    await UiFramework.hideIsolateEmphasizeActionHandler.processClearEmphasize();
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.false;
  });

  it("processHideSelectedElementsModel", async () => {
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.false;
    await UiFramework.hideIsolateEmphasizeActionHandler.processHideSelectedElementsModel();
    expect((UiFramework.hideIsolateEmphasizeActionHandler as TestHideIsolateEmphasizeManager).processHideSelectedElementsModelCalled).to.be.true;
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.true;
    await UiFramework.hideIsolateEmphasizeActionHandler.processClearEmphasize();
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.false;
  });

  it("processHideSelectedElementsCategory", async () => {
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.false;
    await UiFramework.hideIsolateEmphasizeActionHandler.processHideSelectedElementsCategory();
    expect((UiFramework.hideIsolateEmphasizeActionHandler as TestHideIsolateEmphasizeManager).processHideSelectedElementsCategoryCalled).to.be.true;
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.true;
    await UiFramework.hideIsolateEmphasizeActionHandler.processClearEmphasize();
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.false;
  });

  it("processHideSelected", async () => {
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.false;
    await UiFramework.hideIsolateEmphasizeActionHandler.processHideSelected();
    expect((UiFramework.hideIsolateEmphasizeActionHandler as TestHideIsolateEmphasizeManager).processHideSelectedCalled).to.be.true;
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.true;
    await UiFramework.hideIsolateEmphasizeActionHandler.processClearEmphasize();
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.false;
  });

  it("processHideSelected", async () => {
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.false;
    await UiFramework.hideIsolateEmphasizeActionHandler.processHideSelected();
    expect((UiFramework.hideIsolateEmphasizeActionHandler as TestHideIsolateEmphasizeManager).processHideSelectedCalled).to.be.true;
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.true;
    await UiFramework.hideIsolateEmphasizeActionHandler.processClearEmphasize();
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.false;
  });

  it("processClearOverrideModels", async () => {
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.false;
    await UiFramework.hideIsolateEmphasizeActionHandler.processClearOverrideModels();
    expect((UiFramework.hideIsolateEmphasizeActionHandler as TestHideIsolateEmphasizeManager).processClearOverrideModelsCalled).to.be.true;
    await UiFramework.hideIsolateEmphasizeActionHandler.processClearEmphasize();
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.false;
  });

  it("processClearOverrideCategories", async () => {
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.false;
    await UiFramework.hideIsolateEmphasizeActionHandler.processClearOverrideCategories();
    expect((UiFramework.hideIsolateEmphasizeActionHandler as TestHideIsolateEmphasizeManager).processClearOverrideCategoriesCalled).to.be.true;
    await UiFramework.hideIsolateEmphasizeActionHandler.processClearEmphasize();
    expect(UiFramework.hideIsolateEmphasizeActionHandler.areFeatureOverridesActive(vp)).to.be.false;
  });
});
