/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { SpecialKey } from "@itwin/appui-abstract";
import { getUiSettingsManagerEntry, UiSettingsPage } from "../../appui-react/settings/ui/UiSettingsPage";
import TestUtils, { handleError, selectChangeValueByText, storageMock, stubScrollIntoView } from "../TestUtils";
import { UiFramework } from "../../appui-react/UiFramework";
import { ColorTheme } from "../../appui-react/theme/ThemeManager";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";

describe("UiSettingsPage", () => {
  const localStorageToRestore = Object.getOwnPropertyDescriptor(window, "localStorage")!;
  let localStorageMock = storageMock();

  before(async () => {
    await NoRenderApp.startup();
  });

  after(async () => {
    await IModelApp.shutdown();
  });

  beforeEach(async () => {
    // create a new mock each run so there are no "stored values"
    localStorageMock = storageMock();
    await TestUtils.initializeUiFramework();
    UiFramework.setUiVersion("1"); // eslint-disable-line deprecation/deprecation
    await TestUtils.flushAsyncOperations();
    Object.defineProperty(window, "localStorage", {
      get: () => localStorageMock,
    });
  });

  afterEach(() => {
    TestUtils.terminateUiFramework();
    Object.defineProperty(window, "localStorage", localStorageToRestore);
  });

  stubScrollIntoView();

  function getInputBySpanTitle(titleSpan: HTMLElement) {
    const settingsItemDiv = titleSpan.parentElement?.parentElement;
    expect(settingsItemDiv).not.to.be.undefined;
    return settingsItemDiv!.querySelector("input");
  }

  it("renders using getUiSettingsManagerEntry (V1)", async () => {
    const tabEntry = getUiSettingsManagerEntry(10, false); // eslint-disable-line deprecation/deprecation
    const wrapper = render(tabEntry.page);
    expect(wrapper).not.to.be.undefined;
    expect(wrapper.container.querySelectorAll("span.title").length).to.eq(3);
    wrapper.unmount();
  });

  // function getSelectBySpanTitle(titleSpan: HTMLElement) {
  //   const settingsItemDiv = titleSpan.parentElement?.parentElement;
  //   expect(settingsItemDiv).not.to.be.undefined;
  //   return settingsItemDiv!.querySelector("select");
  // }

  it("renders without version option (V1) set theme", async () => {
    const wrapper = render(<UiSettingsPage allowSettingUiFrameworkVersion={false} />); // eslint-disable-line deprecation/deprecation
    expect(wrapper).not.to.be.undefined;

    // const themeSpan = wrapper.getByText("settings.uiSettingsPage.themeTitle");
    // const themeSelect = getSelectBySpanTitle(themeSpan);
    // expect(themeSelect).not.to.be.null;
    // await TestUtils.flushAsyncOperations();
    // fireEvent.change(themeSelect!, { target: { value: "dark" } });
    // await TestUtils.flushAsyncOperations();
    // expect(themeSelect!.value).to.be.eq("dark");
    // fireEvent.change(themeSelect!, { target: { value: "light" } });
    // await TestUtils.flushAsyncOperations();
    // expect(themeSelect!.value).to.be.eq("light");

    const selectButton = wrapper.getByTestId("select-theme");
    selectChangeValueByText(selectButton, "settings.uiSettingsPage.dark", handleError);
    await TestUtils.flushAsyncOperations();
    expect(UiFramework.getColorTheme()).to.eq(ColorTheme.Dark);
    selectChangeValueByText(selectButton, "settings.uiSettingsPage.light", handleError);
    await TestUtils.flushAsyncOperations();
    expect(UiFramework.getColorTheme()).to.eq(ColorTheme.Light);

    wrapper.unmount();
  });

  it("renders without version option (V1) set widget opacity", async () => {
    UiFramework.setUiVersion("1"); // eslint-disable-line deprecation/deprecation
    await TestUtils.flushAsyncOperations();

    const wrapper = render(<UiSettingsPage allowSettingUiFrameworkVersion={false} />); // eslint-disable-line deprecation/deprecation
    expect(wrapper).not.to.be.undefined;
    const thumb = wrapper.container.ownerDocument.querySelector(".iui-slider-thumb");
    expect(thumb).to.exist;
    fireEvent.keyDown(thumb!, { key: SpecialKey.ArrowRight });
    await TestUtils.flushAsyncOperations();
    let widgetOpacity = UiFramework.getWidgetOpacity();
    expect(widgetOpacity).greaterThan(.9);
    await TestUtils.flushAsyncOperations();
    // trigger sync event processing
    UiFramework.setWidgetOpacity(.5);
    await TestUtils.flushAsyncOperations();
    widgetOpacity = UiFramework.getWidgetOpacity();
    expect(widgetOpacity).equals(.5);
    wrapper.unmount();
  });

  it("renders without version option (V2) set toolbar opacity", async () => {
    UiFramework.setUiVersion("2"); // eslint-disable-line deprecation/deprecation
    await TestUtils.flushAsyncOperations();

    const wrapper = render(<UiSettingsPage allowSettingUiFrameworkVersion={false} />); // eslint-disable-line deprecation/deprecation
    expect(wrapper).not.to.be.undefined;
    const thumb = wrapper.container.ownerDocument.querySelectorAll(".iui-slider-thumb");
    expect(thumb[0]).to.exist;
    fireEvent.keyDown(thumb[0]!, { key: SpecialKey.ArrowRight });
    await TestUtils.flushAsyncOperations();
    let toolbarOpacity = UiFramework.getToolbarOpacity();
    expect(toolbarOpacity).greaterThan(.5);
    await TestUtils.flushAsyncOperations();
    // trigger sync event processing
    UiFramework.setToolbarOpacity(.9);
    await TestUtils.flushAsyncOperations();
    toolbarOpacity = UiFramework.getToolbarOpacity();
    expect(toolbarOpacity).equals(.9);
    wrapper.unmount();
  });

  it("renders without version option (V1) toggle auto-hide", async () => {
    UiFramework.setUiVersion("1"); // eslint-disable-line deprecation/deprecation
    await TestUtils.flushAsyncOperations();

    const wrapper = render(<UiSettingsPage allowSettingUiFrameworkVersion={false} />); // eslint-disable-line deprecation/deprecation
    expect(wrapper).not.to.be.undefined;
    const autoHideSpan = wrapper.getByText("settings.uiSettingsPage.autoHideTitle");
    const checkbox = getInputBySpanTitle(autoHideSpan);
    expect(checkbox).not.to.be.null;
    fireEvent.click(checkbox!);
    await TestUtils.flushAsyncOperations();
    expect(checkbox?.checked).to.be.false; // defaults to true so this should make if false
    fireEvent.click(checkbox!);
    await TestUtils.flushAsyncOperations();
    expect(checkbox?.checked).to.be.true;
    expect(wrapper.container.querySelectorAll("span.title").length).to.eq(3);
    wrapper.unmount();
  });

  it("renders with version option (V1)", async () => {
    UiFramework.setUiVersion("1"); // eslint-disable-line deprecation/deprecation
    await TestUtils.flushAsyncOperations();

    const wrapper = render(<UiSettingsPage allowSettingUiFrameworkVersion={true} />); // eslint-disable-line deprecation/deprecation
    expect(wrapper).not.to.be.undefined;
    expect(wrapper.container.querySelectorAll("span.title").length).to.eq(4);

    const titleSpan = wrapper.getByText("settings.uiSettingsPage.newUiTitle");
    const checkbox = getInputBySpanTitle(titleSpan);
    expect(checkbox).not.to.be.null;
    fireEvent.click(checkbox!);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.container.querySelectorAll("span.title").length).to.eq(12);

    wrapper.unmount();
  });

  it("renders without version option (V2) toggle drag interaction", async () => {
    UiFramework.setUiVersion("2"); // eslint-disable-line deprecation/deprecation
    await TestUtils.flushAsyncOperations();
    const wrapper = render(<UiSettingsPage allowSettingUiFrameworkVersion={false} />); // eslint-disable-line deprecation/deprecation
    expect(wrapper).not.to.be.undefined;

    const titleSpan = wrapper.getByText("settings.uiSettingsPage.dragInteractionTitle");
    const checkbox = getInputBySpanTitle(titleSpan);
    fireEvent.click(checkbox!);
    await TestUtils.flushAsyncOperations();
    expect(checkbox?.checked).to.be.true;
    fireEvent.click(checkbox!);
    await TestUtils.flushAsyncOperations();
    expect(checkbox?.checked).to.be.false;
    wrapper.unmount();
  });

  it("renders without version option (V2) toggle useProximityOpacity", async () => {
    UiFramework.setUiVersion("2"); // eslint-disable-line deprecation/deprecation
    await TestUtils.flushAsyncOperations();
    const wrapper = render(<UiSettingsPage allowSettingUiFrameworkVersion={false} />); // eslint-disable-line deprecation/deprecation
    expect(wrapper).not.to.be.undefined;

    const titleSpan = wrapper.getByText("settings.uiSettingsPage.useProximityOpacityTitle");
    const checkbox = getInputBySpanTitle(titleSpan);
    fireEvent.click(checkbox!);
    await TestUtils.flushAsyncOperations();
    expect(checkbox?.checked).to.be.true; // latest default value
    fireEvent.click(checkbox!);
    await TestUtils.flushAsyncOperations();
    expect(checkbox?.checked).to.be.false;
    wrapper.unmount();
  });

  it("renders without version option (V2) toggle snapWidgetOpacity", async () => {
    UiFramework.setUiVersion("2"); // eslint-disable-line deprecation/deprecation
    await TestUtils.flushAsyncOperations();
    const wrapper = render(<UiSettingsPage allowSettingUiFrameworkVersion={false} />); // eslint-disable-line deprecation/deprecation
    expect(wrapper).not.to.be.undefined;

    const titleSpan = wrapper.getByText("settings.uiSettingsPage.snapWidgetOpacityTitle");
    const checkbox = getInputBySpanTitle(titleSpan);
    fireEvent.click(checkbox!);
    await TestUtils.flushAsyncOperations();
    expect(checkbox?.checked).to.be.true;
    fireEvent.click(checkbox!);
    await TestUtils.flushAsyncOperations();
    expect(checkbox?.checked).to.be.false;
    wrapper.unmount();
  });

  it("renders showWidgetIcon toggle", async () => {
    UiFramework.setUiVersion("2"); // eslint-disable-line deprecation/deprecation
    await TestUtils.flushAsyncOperations();
    const wrapper = render(<UiSettingsPage allowSettingUiFrameworkVersion={false} />); // eslint-disable-line deprecation/deprecation
    expect(wrapper).not.to.be.undefined;

    const titleSpan = wrapper.getByText("settings.uiSettingsPage.widgetIconTitle");
    const checkbox = getInputBySpanTitle(titleSpan);
    fireEvent.click(checkbox!);
    await TestUtils.flushAsyncOperations();
    expect(checkbox?.checked).to.be.false;
    fireEvent.click(checkbox!);
    await TestUtils.flushAsyncOperations();
    expect(checkbox?.checked).to.be.true;
    wrapper.unmount();
  });

  it("renders with version option (V2) toggle ui-version", async () => {
    UiFramework.setUiVersion("2"); // eslint-disable-line deprecation/deprecation
    await TestUtils.flushAsyncOperations();
    const wrapper = render(<UiSettingsPage allowSettingUiFrameworkVersion={true} />); // eslint-disable-line deprecation/deprecation
    expect(wrapper).not.to.be.undefined;
    expect(wrapper.container.querySelectorAll("span.title").length).to.eq(12);
    const uiVersionSpan = wrapper.getByText("settings.uiSettingsPage.newUiTitle");
    const checkbox = getInputBySpanTitle(uiVersionSpan);

    fireEvent.click(checkbox!);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.container.querySelectorAll("span.title").length).to.eq(4);

    fireEvent.click(checkbox!);
    await TestUtils.flushAsyncOperations();
    expect(wrapper.container.querySelectorAll("span.title").length).to.eq(12);

    wrapper.unmount();
  });

  it("renders animateToolSettings toggle", async () => {
    UiFramework.setUiVersion("2"); // eslint-disable-line deprecation/deprecation
    await TestUtils.flushAsyncOperations();
    const wrapper = render(<UiSettingsPage allowSettingUiFrameworkVersion={false} />); // eslint-disable-line deprecation/deprecation
    expect(wrapper).not.to.be.undefined;

    const titleSpan = wrapper.getByText("settings.uiSettingsPage.animateToolSettingsTitle");
    const checkbox = getInputBySpanTitle(titleSpan);
    fireEvent.click(checkbox!);
    await TestUtils.flushAsyncOperations();
    expect(checkbox?.checked).to.be.true;
    fireEvent.click(checkbox!);
    await TestUtils.flushAsyncOperations();
    expect(checkbox?.checked).to.be.false;
    wrapper.unmount();
  });

  it("renders useToolAsToolSettingsLabel toggle", async () => {
    UiFramework.setUiVersion("2"); // eslint-disable-line deprecation/deprecation
    await TestUtils.flushAsyncOperations();
    const wrapper = render(<UiSettingsPage allowSettingUiFrameworkVersion={false} />); // eslint-disable-line deprecation/deprecation
    expect(wrapper).not.to.be.undefined;

    const titleSpan = wrapper.getByText("settings.uiSettingsPage.useToolAsToolSettingsLabelTitle");
    const checkbox = getInputBySpanTitle(titleSpan);
    fireEvent.click(checkbox!);
    await TestUtils.flushAsyncOperations();
    expect(checkbox?.checked).to.be.true;
    fireEvent.click(checkbox!);
    await TestUtils.flushAsyncOperations();
    expect(checkbox?.checked).to.be.false;
    wrapper.unmount();
  });

});
