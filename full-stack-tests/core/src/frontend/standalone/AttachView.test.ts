/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  MockRender, ScreenViewport, SnapshotConnection, SpatialViewState,
} from "@bentley/imodeljs-frontend";

describe("ViewState attached to Viewport", async () => {
  let imodel: SnapshotConnection;
  let vp: ScreenViewport;

  const div = document.createElement("div");
  div.style.width = div.style.height = "40px";
  document.body.appendChild(div);

  before(async () => {
    await MockRender.App.startup();
    imodel = await SnapshotConnection.openFile("test.bim");
  });

  after(async () => {
    await imodel.close();
    await MockRender.App.shutdown();
  });

  afterEach(() => {
    if (vp && !vp.isDisposed)
      vp.dispose();
  });

  async function loadView(id = "0x34"): Promise<SpatialViewState> {
    const view = await imodel.views.load(id);
    expect(view).instanceof(SpatialViewState);
    return view as SpatialViewState;
  }

  it("should attach to viewport on construction", async () => {
    const view = await loadView();
    expect(view.isAttachedToViewport).to.be.false;
    vp = ScreenViewport.create(div, view);
    expect(view.isAttachedToViewport).to.be.true;
  });

  it("should detch when viewport is disposed", async () => {
    const view = await loadView();
    vp = ScreenViewport.create(div, view);
    expect(view.isAttachedToViewport).to.be.true;
    vp.dispose();
    expect(view.isAttachedToViewport).to.be.false;
  });

  it("should detach when Viewport.changeView is used", async () => {
    const v1 = await loadView();
    const v2 = v1.clone();
    vp = ScreenViewport.create(div, v1);
    expect(v1.isAttachedToViewport).to.be.true;
    expect(v2.isAttachedToViewport).to.be.false;

    vp.changeView(v2);

    expect(v1.isAttachedToViewport).to.be.false;
    expect(v2.isAttachedToViewport).to.be.true;
  });

  it("should detach when Viewport.applyViewState is used", async () => {
    const v1 = await loadView();
    const v2 = v1.clone();
    vp = ScreenViewport.create(div, v1);
    expect(v1.isAttachedToViewport).to.be.true;
    expect(v2.isAttachedToViewport).to.be.false;

    vp.applyViewState(v2);

    expect(v1.isAttachedToViewport).to.be.false;
    expect(v2.isAttachedToViewport).to.be.true;
  });

  it("should throw when attempting to detach while not attached", async () => {
    const view = await loadView();
    vp = ScreenViewport.create(div, view.clone());
    expect(view.isAttachedToViewport).to.be.false;
    expect(() => view.detachFromViewport()).to.throw("Attempting to detach a ViewState from a Viewport to which it is not attached.");
  });

  it("should throw when attempting to attach while already attached", async () => {
    const view = await loadView();
    vp = ScreenViewport.create(div, view);
    expect(view.isAttachedToViewport).to.be.true;
    expect(() => view.attachToViewport()).to.throw("Attempting to attach a ViewState that is already attached to a Viewport");
  });

  it("should only emit events while attached to a Viewport", async () => {
    let categoriesChanged = false;
    let modelsChanged = false;
    let styleChanged = false;

    const reset = () => categoriesChanged = modelsChanged = styleChanged = false;
    const expectChanges = (categories: boolean, models: boolean, style: boolean) => {
      expect(categoriesChanged).to.equal(categories);
      expect(modelsChanged).to.equal(models);
      expect(styleChanged).to.equal(style);
    };

    const view = await loadView();
    view.onViewedCategoriesChanged.addListener(() => categoriesChanged = true);
    view.onViewedModelsChanged.addListener(() => modelsChanged = true);
    view.onDisplayStyleChanged.addListener(() => styleChanged = true);

    view.categorySelector = view.categorySelector.clone();
    view.modelSelector = view.modelSelector.clone();
    view.displayStyle = view.displayStyle.clone();
    expectChanges(false, false, false);

    view.modelSelector.models.add("0x123");
    view.categorySelector.categories.add("0xfed");
    expectChanges(false, false, false);

    vp = ScreenViewport.create(div, view);

    view.categorySelector.categories.add("0xabc");
    view.modelSelector.models.add("0x321");
    expectChanges(true, true, false);

    reset();
    view.categorySelector = view.categorySelector.clone();
    view.modelSelector = view.modelSelector.clone();
    view.displayStyle = view.displayStyle.clone();
    expectChanges(true, true, true);

    reset();
    view.categorySelector.categories.add("0xabc");
    view.modelSelector.models.add("0x321");
    view.displayStyle = view.displayStyle.clone();
    expectChanges(false, false, true);

    reset();
    vp.dispose();
    view.modelSelector.models.add("0xa");
    view.categorySelector.categories.add("0xb");
    view.categorySelector = view.categorySelector.clone();
    view.modelSelector = view.modelSelector.clone();
    view.displayStyle = view.displayStyle.clone();
    expectChanges(false, false, false);

    vp = ScreenViewport.create(div, view);
    view.modelSelector.models.add("0xa");
    view.categorySelector.categories.add("0xb");
    view.categorySelector = view.categorySelector.clone();
    view.modelSelector = view.modelSelector.clone();
    view.displayStyle = view.displayStyle.clone();
    expectChanges(true, true, true);
  });

  it("should re-target event listeners when category or model selector changes", async () => {
    let categoriesChanged = false;
    let modelsChanged = false;
    const reset = () => categoriesChanged = modelsChanged = false;
    const expectChanges = (categories: boolean, models: boolean) => {
      expect(categoriesChanged).to.equal(categories);
      expect(modelsChanged).to.equal(models);
    };

    const view = await loadView();
    vp = ScreenViewport.create(div, view);
    view.onViewedCategoriesChanged.addListener(() => categoriesChanged = true);
    view.onViewedModelsChanged.addListener(() => modelsChanged = true);

    const categories1 = view.categorySelector;
    const models1 = view.modelSelector;
    categories1.categories.add("0x1");
    models1.models.add("0x2");
    expectChanges(true, true);

    reset();
    const categories2 = categories1.clone();
    const models2 = models1.clone();
    view.categorySelector = categories2;
    view.modelSelector = models2;
    expectChanges(true, true);

    reset();
    categories1.categories.add("0x3");
    models1.models.add("0x4");
    expectChanges(false, false);

    reset();
    categories2.categories.add("0x3");
    models2.models.add("0x4");
    expectChanges(true, true);
  });
});
