/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Provider } from "react-redux";
import { mount } from "enzyme";
import { expect } from "chai";

import TestUtils from "../TestUtils";
import {
  StatusBar,
  PromptField,
  StatusBarWidgetControl,
  WidgetState,
  ConfigurableCreateInfo,
  MessageManager,
  ConfigurableUiControlType,
  WidgetDef,
  StatusBarWidgetControlArgs,
} from "../../ui-framework";

describe("PromptField", () => {

  class AppStatusBarWidgetControl extends StatusBarWidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);
    }

    public getReactNode({ isInFooterMode, openWidget }: StatusBarWidgetControlArgs): React.ReactNode {
      if (openWidget) { }
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

    wrapper.unmount();
  });

});
