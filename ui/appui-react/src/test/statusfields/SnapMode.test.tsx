/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { Provider } from "react-redux";
import { fireEvent, render } from "@testing-library/react";
import { MockRender, SnapMode } from "@itwin/core-frontend";
import { WidgetState } from "@itwin/appui-abstract";
import {
  ConfigurableCreateInfo, ConfigurableUiControlType, SnapModeField, StatusBar, StatusBarWidgetControl, StatusBarWidgetControlArgs, UiFramework,
  WidgetDef,
} from "../../appui-react";
import TestUtils from "../TestUtils";

describe("SnapModeField", () => {

  class AppStatusBarWidgetControl extends StatusBarWidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);
    }

    // eslint-disable-next-line deprecation/deprecation
    public getReactNode({ isInFooterMode }: StatusBarWidgetControlArgs): React.ReactNode {
      return (
        <>
          <SnapModeField isInFooterMode={isInFooterMode} />
        </>
      );
    }
  }

  let widgetControl: StatusBarWidgetControl | undefined;

  before(async () => {
    // use mock renderer so standards tools are registered.
    await MockRender.App.startup();
    await TestUtils.initializeUiFramework();

    const statusBarWidgetDef = new WidgetDef({ // eslint-disable-line deprecation/deprecation
      classId: AppStatusBarWidgetControl,
      defaultState: WidgetState.Open,
      isFreeform: false,
      isStatusBar: true,
    });
    widgetControl = statusBarWidgetDef.getWidgetControl(ConfigurableUiControlType.StatusBarWidget) as StatusBarWidgetControl;
  });

  after(async () => {
    TestUtils.terminateUiFramework();
    await MockRender.App.shutdown();
  });

  it("Status Bar with SnapModes Field should render", () => {
    const modes = [
      SnapMode.NearestKeypoint as number, SnapMode.Intersection as number, SnapMode.Center as number,
      SnapMode.Nearest as number, SnapMode.Origin as number, SnapMode.MidPoint as number, SnapMode.Bisector as number,
    ];

    const icons = ["icon-snaps", "icon-snaps-intersection", "icon-snaps-center", "icon-snaps-nearest",
      "icon-snaps-origin", "icon-snaps-midpoint", "icon-snaps-bisector"];

    const wrapper = render(<Provider store={TestUtils.store}>
      <StatusBar widgetControl={widgetControl} isInFooterMode={true} />
    </Provider>);

    const button = wrapper.container.querySelector(".uifw-footer-indicator");
    expect(button).not.to.be.null;
    fireEvent.click(button!);

    const iconContainer = wrapper.container.querySelector(".uifw-indicator-icon");
    expect(iconContainer).not.to.be.null;

    // wrapper.debug();
    const popup = wrapper.getByTestId("core-popup");
    const snaps = popup.querySelectorAll(".nz-footer-snapMode-snap");
    expect(snaps.length).to.eql(7);

    for (let i = 0; i < 7; i++) {
      // Simulate selecting a snap mode
      fireEvent.click(snaps[i]);

      // ensure the snap mode selected sets the state of the store.
      const snapMode = UiFramework.frameworkState ? UiFramework.frameworkState.configurableUiState.snapMode : SnapMode.NearestKeypoint;
      expect(snapMode).to.eq(modes[i]);

      // the indicator field should contain the selected snap icon.
      expect(iconContainer!.querySelector(`.${icons[i]}`)).not.to.be.null;
    }

    fireEvent.click(button!); // Closes popup
  });

  it("Validate multiple snaps mode", () => {
    // force to use multi-snap
    UiFramework.setAccudrawSnapMode(SnapMode.Intersection | SnapMode.NearestKeypoint);
    const snapMode = UiFramework.getAccudrawSnapMode();
    expect(snapMode).to.be.equal(SnapMode.Intersection | SnapMode.NearestKeypoint);
    const wrapper = render(<Provider store={TestUtils.store}>
      <StatusBar widgetControl={widgetControl} isInFooterMode={true} />
    </Provider>);
    const iconContainer = wrapper.container.querySelector(".uifw-indicator-icon");
    expect(iconContainer).not.to.be.null;
    expect(iconContainer!.querySelector(".icon-snaps-multione")).not.to.be.null;
  });

});
