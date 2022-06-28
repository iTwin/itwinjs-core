/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { storageMock, TestUtils } from "../TestUtils";
import { UiFramework } from "../../appui-react/UiFramework";
import { AppUiSettings, InitialAppUiSettings } from "../../appui-react/uistate/AppUiSettings";
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
    await uiSetting.loadUserSettings(UiFramework.getUiStateStorage());
    const uiVersion = "2";
    const opacity = 0.5;
    const colorTheme = "dark";
    const useDragInteraction = true;
    const showWidgetIcon = false;
    const animateToolSettings = false;
    const autoCollapseUnpinnedPanels = true;
    const useToolAsToolSettingsLabel = false;

    UiFramework.setUiVersion(uiVersion);
    UiFramework.setWidgetOpacity(opacity);
    UiFramework.setWidgetOpacity(opacity);
    UiFramework.setUseDragInteraction(true);
    UiFramework.setColorTheme(colorTheme);
    UiFramework.setUseDragInteraction(useDragInteraction);
    UiFramework.setShowWidgetIcon(showWidgetIcon);
    UiFramework.setAutoCollapseUnpinnedPanels(autoCollapseUnpinnedPanels);
    UiFramework.setAutoCollapseUnpinnedPanels(autoCollapseUnpinnedPanels); // verify it handles the same value again
    UiFramework.setAnimateToolSettings(animateToolSettings);
    UiFramework.setUseToolAsToolSettingsLabel(useToolAsToolSettingsLabel);
    await TestUtils.flushAsyncOperations();
    expect(UiFramework.uiVersion).to.eql(uiVersion);
    expect(UiFramework.getWidgetOpacity()).to.eql(opacity);
    expect(UiFramework.getColorTheme()).to.eql(colorTheme);
    expect(UiFramework.useDragInteraction).to.eql(useDragInteraction);
    expect(UiFramework.showWidgetIcon).to.eql(showWidgetIcon);
    expect(UiFramework.autoCollapseUnpinnedPanels).to.eql(autoCollapseUnpinnedPanels);
    expect(UiFramework.animateToolSettings).to.eql(animateToolSettings);
    expect(UiFramework.useToolAsToolSettingsLabel).to.eql(useToolAsToolSettingsLabel);
  });

  it("should used default settings", async () => {
    const defaults: InitialAppUiSettings = {
      colorTheme: SYSTEM_PREFERRED_COLOR_THEME,
      dragInteraction: false,
      frameworkVersion: "2",
      widgetOpacity: 0.8,
      showWidgetIcon: true,
      autoCollapseUnpinnedPanels: true,
      animateToolSettings: true,
      useToolAsToolSettingsLabel: true,
    };

    const uiSetting = new AppUiSettings(defaults);
    await uiSetting.loadUserSettings(UiFramework.getUiStateStorage());
    await TestUtils.flushAsyncOperations();
    expect(UiFramework.uiVersion).to.eql(defaults.frameworkVersion);
    expect(UiFramework.getWidgetOpacity()).to.eql(defaults.widgetOpacity);
    expect(UiFramework.getColorTheme()).to.eql(defaults.colorTheme);
    expect(UiFramework.useDragInteraction).to.eql(defaults.dragInteraction);
    expect(UiFramework.showWidgetIcon).to.eql(defaults.showWidgetIcon);
    expect(UiFramework.autoCollapseUnpinnedPanels).to.eql(defaults.autoCollapseUnpinnedPanels);
    expect(UiFramework.animateToolSettings).to.eql(defaults.animateToolSettings);
    expect(UiFramework.useToolAsToolSettingsLabel).to.eql(defaults.useToolAsToolSettingsLabel);
  });

});
