/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
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
  WidgetState,
  ConfigurableCreateInfo,
  UiFramework,
  ConfigurableUiControlType,
  WidgetDef,
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

  // cSpell:Ignore TOOLPROMPT
  it("Status Bar with PromptField should mount", () => {
    const wrapper = mount(<Provider store={TestUtils.store}>
      <StatusBar widgetControl={widgetControl} isInFooterMode={true} />
    </Provider>);

    UiFramework.store.dispatch({ type: "ConfigurableUi:SET_TOOLPROMPT", payload: "Hello World!" });
    wrapper.update();

    expect(wrapper.find("div.nz-footer-text").length).to.eq(1);
    expect(wrapper.find("div.nz-footer-text").text()).to.eq("Hello World!");

    UiFramework.store.dispatch({ type: "ConfigurableUi:SET_TOOLPROMPT", payload: "Goodbye!" });
    wrapper.update();
    expect(wrapper.find("div.nz-footer-text").length).to.eq(1);
    expect(wrapper.find("div.nz-footer-text").text()).to.eq("Goodbye!");

    wrapper.unmount();
  });

});
