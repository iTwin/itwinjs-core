/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";
import { Provider } from "react-redux";

import TestUtils from "../TestUtils";
import { SnapMode } from "@bentley/imodeljs-frontend";

import {
  SnapModeField,
  StatusBarWidgetControl,
  StatusBar,
  WidgetState,
  ConfigurableCreateInfo,
  IStatusBar,
  StatusBarFieldId,
  WidgetDef,
  ConfigurableUiControlType,
  UiFramework,
} from "../../ui-framework";

describe("SnapModeField", () => {

  class AppStatusBarWidgetControl extends StatusBarWidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);
    }

    public getReactNode(statusBar: IStatusBar, isInFooterMode: boolean, openWidget: StatusBarFieldId): React.ReactNode {
      return (
        <>
          <SnapModeField statusBar={statusBar} isInFooterMode={isInFooterMode} openWidget={openWidget} />
        </>
      );
    }
  }

  let widgetControl: StatusBarWidgetControl | undefined;

  before(async () => {
    await TestUtils.initializeUiFramework();

    const statusBarWidgetDef = new WidgetDef({
      classId: AppStatusBarWidgetControl,
      defaultState: WidgetState.Open,
      isFreeform: false,
      isStatusBar: true,
    });
    widgetControl = statusBarWidgetDef.getWidgetControl(ConfigurableUiControlType.StatusBarWidget) as StatusBarWidgetControl;
  });

  it("Status Bar with SnapModes Field should mount", () => {
    const modes = [SnapMode.NearestKeypoint as number, SnapMode.Intersection as number, SnapMode.Center as number,
    SnapMode.Nearest as number, SnapMode.Origin as number, SnapMode.MidPoint as number, SnapMode.Bisector as number];

    const icons = ["icon-snaps", "icon-snaps-intersection", "icon-snaps-center", "icon-snaps-nearest",
      "icon-snaps-origin", "icon-snaps-midpoint", "icon-snaps-bisector"];

    const wrapper = mount(<Provider store={TestUtils.store}>
      <StatusBar widgetControl={widgetControl} isInFooterMode={true} />
    </Provider>);

    for (let i = 0; i < 7; i++) {
      // Simulate a click to open the pop-up dialog
      wrapper.find("div.nz-footer-snapMode-indicator").simulate("click"); // Opens it
      wrapper.update();

      // Simulate selecting a snap mode
      const snaps = wrapper.find("div.nz-footer-snapMode-snap");
      expect(snaps.length).to.eq(7);
      snaps.at(i).simulate("click");
      wrapper.update();

      // ensure the snap mode selected sets the state of the store.
      const snapMode = UiFramework.frameworkState ? UiFramework.frameworkState.configurableUiState.snapMode : SnapMode.NearestKeypoint;
      expect(snapMode).to.eq(modes[i]);

      // the indicator field should contain the selected snap icon.
      const itemId = "div." + icons[i];
      expect(wrapper.find(itemId).length).to.eq(1);
    }

    wrapper.unmount();
  });

  it("Validate multiple snaps mode", () => {

    // force to use multi-snap
    UiFramework.setAccudrawSnapMode(SnapMode.Intersection | SnapMode.NearestKeypoint);
    const snapMode = UiFramework.getAccudrawSnapMode();
    expect(snapMode).to.be.equal(SnapMode.Intersection | SnapMode.NearestKeypoint);
    const wrapper = mount(<Provider store={TestUtils.store}>
      <StatusBar widgetControl={widgetControl} isInFooterMode={true} />
    </Provider>);

    // the indicator field should contain the multi-snap icon.
    const itemId = "div.icon-snaps-multione";
    expect(wrapper.find(itemId).length).to.eq(1);

    wrapper.unmount();
  });

});
