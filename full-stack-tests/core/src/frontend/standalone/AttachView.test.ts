/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "vitest";
import { ScreenViewport, SpatialViewState } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";
import { TestSnapshotConnection } from "../TestSnapshotConnection";

describe("ViewState attached to Viewport", async () => {
  let imodel: TestSnapshotConnection;
  let vp: ScreenViewport;

  const div = document.createElement("div");
  div.style.width = div.style.height = "40px";
  document.body.appendChild(div);

  beforeAll(async () => {
    await TestUtility.startFrontend(undefined, true);
    imodel = await TestSnapshotConnection.openFile("test.bim");
  });

  afterAll(async () => {
    await imodel.close();
    await TestUtility.shutdownFrontend();
  });

  afterEach(() => {
    if (vp && !vp.isDisposed)
      vp[Symbol.dispose]();
  });

  async function loadView(id = "0x34"): Promise<SpatialViewState> {
    const view = await imodel.views.load(id);
    expect(view).toBeInstanceOf(SpatialViewState);
    return view as SpatialViewState;
  }

  it("should attach to viewport on construction", async () => {
    const view = await loadView();
    expect(view.isAttachedToViewport).toBe(false);
    vp = ScreenViewport.create(div, view);
    expect(view.isAttachedToViewport).toBe(true);
  });

  it("should detach when viewport is disposed", async () => {
    const view = await loadView();
    vp = ScreenViewport.create(div, view);
    expect(view.isAttachedToViewport).toBe(true);
    vp[Symbol.dispose]();
    expect(view.isAttachedToViewport).toBe(false);
  });

  it("should detach when Viewport.changeView is used", async () => {
    const v1 = await loadView();
    const v2 = v1.clone();
    vp = ScreenViewport.create(div, v1);
    expect(v1.isAttachedToViewport).toBe(true);
    expect(v2.isAttachedToViewport).toBe(false);

    vp.changeView(v2);

    expect(v1.isAttachedToViewport).toBe(false);
    expect(v2.isAttachedToViewport).toBe(true);
  });

  it("should detach when Viewport.applyViewState is used", async () => {
    const v1 = await loadView();
    const v2 = v1.clone();
    vp = ScreenViewport.create(div, v1);
    expect(v1.isAttachedToViewport).toBe(true);
    expect(v2.isAttachedToViewport).toBe(false);

    vp.applyViewState(v2);

    expect(v1.isAttachedToViewport).toBe(false);
    expect(v2.isAttachedToViewport).toBe(true);
  });

  it("should throw when attempting to detach while not attached", async () => {
    const view = await loadView();
    vp = ScreenViewport.create(div, view.clone());
    expect(view.isAttachedToViewport).toBe(false);
    expect(() => view.detachFromViewport()).to.throw("Attempting to detach a ViewState from a Viewport to which it is not attached.");
  });

  it("should throw when attempting to attach while already attached", async () => {
    const view = await loadView();
    vp = ScreenViewport.create(div, view);
    expect(view.isAttachedToViewport).toBe(true);
    expect(() => view.attachToViewport(vp)).to.throw("Attempting to attach a ViewState that is already attached to a Viewport");
  });

  it("should only emit events while attached to a Viewport", async () => {
    let categoriesChanged = false;
    let modelsChanged = false;

    const reset = () => categoriesChanged = modelsChanged = false;
    const expectChanges = (categories: boolean, models: boolean) => {
      expect(categoriesChanged).toBe(categories);
      expect(modelsChanged).toBe(models);
    };

    const view = await loadView();
    view.onViewedCategoriesChanged.addListener(() => categoriesChanged = true);
    view.onViewedModelsChanged.addListener(() => modelsChanged = true);

    view.modelSelector.models.add("0x123");
    view.categorySelector.categories.add("0xfed");
    expectChanges(false, false);

    vp = ScreenViewport.create(div, view);

    view.categorySelector.categories.add("0xabc");
    view.modelSelector.models.add("0x321");
    expectChanges(true, true);

    reset();
    view.categorySelector.categories.add("0xabc");
    view.modelSelector.models.add("0x321");
    expectChanges(false, false);

    reset();
    vp[Symbol.dispose]();
    view.modelSelector.models.add("0xa");
    view.categorySelector.categories.add("0xb");
    expectChanges(false, false);

    vp = ScreenViewport.create(div, view);
    view.modelSelector.models.add("0xabc");
    view.categorySelector.categories.add("0xdef");
    expectChanges(true, true);
  });
});
