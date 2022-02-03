/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { Provider } from "react-redux";
import { WidgetState } from "@itwin/appui-abstract";
import type {
  ConfigurableCreateInfo, StatusBarWidgetControlArgs} from "../../appui-react";
import { ConfigurableUiControlType, MessageManager, PromptField, StatusBar, StatusBarWidgetControl,
  WidgetDef,
} from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";

describe("PromptField", () => {

  class AppStatusBarWidgetControl extends StatusBarWidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);
    }

    public getReactNode({ isInFooterMode, openWidget }: StatusBarWidgetControlArgs): React.ReactNode {
      if (openWidget) { }
      return (
        <>
          <PromptField isInFooterMode={isInFooterMode} openWidget={null} onOpenWidget={() => { }} />   {/* eslint-disable-line deprecation/deprecation */}
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

  after(() => {
    TestUtils.terminateUiFramework();
  });

  // cSpell:Ignore TOOLPROMPT
  it("Status Bar with PromptField should mount", () => {
    const wrapper = mount(<Provider store={TestUtils.store}>
      <StatusBar widgetControl={widgetControl} isInFooterMode={true} />
    </Provider>);

    const helloWorld = "Hello World!";
    MessageManager.outputPrompt(helloWorld);
    wrapper.update();

    expect(wrapper.find("div.uifw-statusFields-promptField").length).to.eq(1);
    expect(wrapper.find("div.uifw-statusFields-promptField").text()).to.eq(helloWorld);

    const goodBye = "Goodbye!";
    MessageManager.outputPrompt(goodBye);
    wrapper.update();
    expect(wrapper.find("div.uifw-statusFields-promptField").length).to.eq(1);
    expect(wrapper.find("div.uifw-statusFields-promptField").text()).to.eq(goodBye);
  });

});
