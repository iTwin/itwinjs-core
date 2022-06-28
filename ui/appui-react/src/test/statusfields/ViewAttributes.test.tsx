/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { Provider } from "react-redux";
import { WidgetState } from "@itwin/appui-abstract";
import { MockRender } from "@itwin/core-frontend";
import { Checkbox } from "@itwin/itwinui-react";
import { ConfigurableCreateInfo, ConfigurableUiControlType } from "../../appui-react/configurableui/ConfigurableUiControl";
import { StatusBar } from "../../appui-react/statusbar/StatusBar";
import { StatusBarWidgetControl, StatusBarWidgetControlArgs } from "../../appui-react/statusbar/StatusBarWidgetControl";
import { ViewAttributesStatusField } from "../../appui-react/statusfields/ViewAttributes";
import { WidgetDef } from "../../appui-react/widgets/WidgetDef";
import TestUtils, { mount } from "../TestUtils";

[true, false].forEach((withDeprecated) =>{
  const testType = withDeprecated ? " (with deprecated openWidget props)" : "";

  describe(`ViewAttributes${testType}`, () => {
    class AppStatusBarWidgetControl extends StatusBarWidgetControl {
      constructor(info: ConfigurableCreateInfo, options: any) {
        super(info, options);
      }

      // eslint-disable-next-line deprecation/deprecation
      public getReactNode({ isInFooterMode, onOpenWidget, openWidget }: StatusBarWidgetControlArgs): React.ReactNode {
        return (
          <>
            <ViewAttributesStatusField isInFooterMode={isInFooterMode} {...(withDeprecated ? {onOpenWidget, openWidget} : {})} />
          </>
        );
      }
    }

    let widgetControl: StatusBarWidgetControl | undefined;

    before(async () => {
      await TestUtils.initializeUiFramework();
      await MockRender.App.startup();

      const statusBarWidgetDef = new WidgetDef({
        classId: AppStatusBarWidgetControl,
        defaultState: WidgetState.Open,
        isFreeform: false,
        isStatusBar: true,
      });
      widgetControl = statusBarWidgetDef.getWidgetControl(ConfigurableUiControlType.StatusBarWidget) as StatusBarWidgetControl;
    });

    after(async () => {
      await MockRender.App.shutdown();
      TestUtils.terminateUiFramework();
    });

    it("should render", () => {
      mount(<Provider store={TestUtils.store}>
        <StatusBar widgetControl={widgetControl} isInFooterMode={true} />
      </Provider>);
    });

    it("should open/close on click", () => {
      const wrapper = mount(<Provider store={TestUtils.store}>
        <StatusBar widgetControl={widgetControl} isInFooterMode={true} />
      </Provider>);

      // Simulate a click to open the pop-up dialog
      wrapper.find("div.uifw-indicator-icon").simulate("click"); // Opens it
      wrapper.update();

      expect(wrapper.find("div.uifw-view-attributes-contents").length).to.eq(1);

      wrapper.find("div.uifw-indicator-icon").simulate("click"); // Closes it
      wrapper.update();
    });

    it("should process Checkbox clicks", () => {
      const wrapper = mount(<Provider store={TestUtils.store}>
        <StatusBar widgetControl={widgetControl} isInFooterMode={true} />
      </Provider>);

      // Simulate a click to open the pop-up dialog
      wrapper.find("div.uifw-indicator-icon").simulate("click"); // Opens it
      wrapper.update();

      expect(wrapper.find("div.uifw-view-attributes-contents").length).to.eq(1);

      const checkBoxes = wrapper.find(Checkbox);
      expect(checkBoxes.length).to.be.greaterThan(0);

      const acs = checkBoxes.find({ label: "listTools.acs" });
      expect(acs.length).to.be.greaterThan(0);
      acs.at(0).prop("onClick")!();

      const camera = checkBoxes.find({ label: "listTools.camera" });
      expect(camera.length).to.be.greaterThan(0);
      camera.at(0).prop("onClick")!();

      wrapper.find("div.uifw-indicator-icon").simulate("click"); // Closes it
      wrapper.update();
    });
  });
});
