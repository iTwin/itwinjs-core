/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";
import { Provider } from "react-redux";

import TestUtils from "../../TestUtils";
import { SnapMode } from "@bentley/imodeljs-frontend";

import {
  SnapModeField,
  StatusBarWidgetControl,
  StatusBar,
  ZoneDef,
  ConfigurableUiManager,
  ZoneState,
  WidgetState,
  ConfigurableCreateInfo,
  IStatusBar,
  StatusBarFieldId,
} from "../../../src";

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

  let statusBarZoneDef: ZoneDef;

  before(async () => {
    await TestUtils.initializeUiFramework();

    ConfigurableUiManager.unregisterControl("AppStatusBar");
    ConfigurableUiManager.registerControl("AppStatusBar", AppStatusBarWidgetControl);

    statusBarZoneDef = new ZoneDef({
      defaultState: ZoneState.Open,
      allowsMerging: false,
      widgetProps: [
        {
          classId: "AppStatusBar",
          defaultState: WidgetState.Open,
          iconClass: "icon-placeholder",
          labelKey: "SampleApp:Test.my-label",
          isFreeform: false,
          isStatusBar: true,
        },
      ],
    });
  });

  it("Status Bar with SnapModes Field should mount", () => {
    const modes = [SnapMode.NearestKeypoint as number, SnapMode.Intersection as number, SnapMode.Center as number,
    SnapMode.Nearest as number, SnapMode.Origin as number, SnapMode.MidPoint as number, SnapMode.Bisector as number];

    const icons = ["icon-snaps", "icon-snaps-intersection", "icon-snaps-center", "icon-snaps-nearest",
      "icon-snaps-origin", "icon-snaps-midpoint", "icon-snaps-bisector"];

    const wrapper = mount(<Provider store={TestUtils.store}>
      <StatusBar zoneDef={statusBarZoneDef} isInFooterMode={true} />
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
      const snapMode = TestUtils.store.getState().frameworkState!.configurableUIState.snapMode;
      expect(snapMode).to.eq(modes[i]);

      // the indicator field should contain the selected snap icon.
      const itemId = "div." + icons[i];
      expect(wrapper.find(itemId).length).to.eq(1);
    }

    wrapper.unmount();
  });

});
