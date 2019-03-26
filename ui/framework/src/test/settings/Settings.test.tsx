/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";
import { Provider } from "react-redux";
import TestUtils from "../TestUtils";
import {
  SettingsModalFrontstage,
} from "../../ui-framework";

describe("SettingsPage", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("should render", () => {
    const stage = new SettingsModalFrontstage();
    const title = stage.title;
    expect(title).not.to.be.undefined;

    const wrapper = mount(<Provider store={TestUtils.store}>{stage.content as React.ReactElement<any>}</Provider>);
    expect(wrapper).not.to.be.undefined;
    wrapper.unmount();
  });

});
