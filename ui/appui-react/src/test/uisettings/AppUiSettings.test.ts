/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { storageMock, TestUtils } from "../TestUtils";
import { UiFramework } from "../../appui-react/UiFramework";
import { AppUiSettings, InitialAppUiSettings } from "../../appui-react/uisettings/AppUiSettings";
import { SYSTEM_PREFERRED_COLOR_THEME } from "../../appui-react/theme/ThemeManager";

describe("AppUiSettings", () => {
  const localStorageToRestore = Object.getOwnPropertyDescriptor(window, "localStorage")!;
  let localStorageMock = storageMock();

  beforeEach(async () => {
    // create a new mock each run so there are no "stored values"
    localStorageMock = storageMock();
    await TestUtils.initializeUiFramework();
    Object.defineProperty(window, "localStorage", {
      get: () => localStorageMock,
    });
  });

  afterEach(() => {
    TestUtils.terminateUiFramework();
    Object.defineProperty(window, "localStorage", localStorageToRestore);
  });

  it("should get/set settings", async () => {
    const uiSetting = new AppUiSettings({});
    await uiSetting.loadUserSettings(UiFramework.getUiSettingsStorage());
    const uiVersion = "2";
    const opacity = 0.5;
    const colorTheme = "dark";
    const useDragInteraction = true;
    UiFramework.setUiVersion(uiVersion);
    UiFramework.setWidgetOpacity(opacity);
    UiFramework.setWidgetOpacity(opacity);
    UiFramework.setUseDragInteraction(true);
    UiFramework.setColorTheme(colorTheme);
    UiFramework.setUseDragInteraction(useDragInteraction);
    await TestUtils.flushAsyncOperations();
    expect(UiFramework.uiVersion).to.eql(uiVersion);
    expect(UiFramework.getWidgetOpacity()).to.eql(opacity);
    expect(UiFramework.getColorTheme()).to.eql(colorTheme);
    expect(UiFramework.useDragInteraction).to.eql(useDragInteraction);
  });

  it("should used default settings", async () => {
    const defaults: InitialAppUiSettings = {
      colorTheme: SYSTEM_PREFERRED_COLOR_THEME,
      dragInteraction: false,
      frameworkVersion: "2",
      widgetOpacity: 0.8,
    };

    const uiSetting = new AppUiSettings(defaults);
    await uiSetting.loadUserSettings(UiFramework.getUiSettingsStorage());
    await TestUtils.flushAsyncOperations();
    expect(UiFramework.uiVersion).to.eql(defaults.frameworkVersion);
    expect(UiFramework.getWidgetOpacity()).to.eql(defaults.widgetOpacity);
    expect(UiFramework.getColorTheme()).to.eql(defaults.colorTheme);
    expect(UiFramework.useDragInteraction).to.eql(defaults.dragInteraction);
  });

});
