/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { Logger } from "@bentley/bentleyjs-core";
import { SignOutModalFrontstage } from "../../ui-framework";
import TestUtils, { mockUserInfo, mount } from "../TestUtils";

describe("SignOutModalFrontstage", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("should render", () => {
    const stage = new SignOutModalFrontstage(mockUserInfo());
    const title = stage.title;
    expect(title).not.to.be.undefined;

    const wrapper = mount(stage.content as React.ReactElement<any>);
    expect(wrapper).not.to.be.undefined;
  });

  it("should call onSignOut handler", () => {
    const spyMethod = sinon.spy(Logger, "logError");
    const stage = new SignOutModalFrontstage(mockUserInfo());

    const wrapper = mount(stage.content as React.ReactElement<any>);
    wrapper.find("button").simulate("click");
    spyMethod.calledOnce.should.true;
  });

});
