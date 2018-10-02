/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Provider } from "react-redux";
import { mount } from "enzyme";
import { expect } from "chai";

import TestUtils from "../../TestUtils";
import {
  StatusBar,
  StatusBarFieldId,
  IStatusBar,
  PromptField,
  StatusBarWidgetControl,
  ZoneDef,
  ConfigurableUIManager,
  ZoneState,
  WidgetState,
  ConfigurableCreateInfo,
  UiFramework,
} from "../../../src";

describe("PromptField", () => {

  class AppStatusBarWidgetControl extends StatusBarWidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);
    }

    public getReactNode(statusBar: IStatusBar, isInFooterMode: boolean, openWidget: StatusBarFieldId): React.ReactNode {
      if (statusBar && openWidget) { }
      return (
        <>
          <PromptField isInFooterMode={isInFooterMode} />
        </>
      );
    }
  }

  let statusBarZoneDef: ZoneDef;

  before(async () => {
    await TestUtils.initializeUiFramework();

    ConfigurableUIManager.unregisterControl("AppStatusBar");
    ConfigurableUIManager.registerControl("AppStatusBar", AppStatusBarWidgetControl);

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
    if (statusBarZoneDef) { }
  });

  // cSpell:Ignore TOOLPROMPT
  it("Status Bar with PromptField should mount", () => {
    const wrapper = mount(<Provider store={TestUtils.store}>
      <StatusBar zoneDef={statusBarZoneDef} isInFooterMode={true} />
    </Provider>);

    UiFramework.store.dispatch({ type: "ConfigurableUI:SET_TOOLPROMPT", payload: "Hello World!" });
    wrapper.update();

    expect(wrapper.find("div.nz-footer-text").length).to.eq(1);
    expect(wrapper.find("div.nz-footer-text").text()).to.eq("Hello World!");

    UiFramework.store.dispatch({ type: "ConfigurableUI:SET_TOOLPROMPT", payload: "Goodbye!" });
    wrapper.update();
    expect(wrapper.find("div.nz-footer-text").length).to.eq(1);
    expect(wrapper.find("div.nz-footer-text").text()).to.eq("Goodbye!");

    wrapper.unmount();
  });

});
