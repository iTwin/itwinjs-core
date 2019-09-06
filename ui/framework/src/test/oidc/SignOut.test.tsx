/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { mount } from "enzyme";
import { expect } from "chai";

import TestUtils, { MockAccessToken } from "../TestUtils";
import { SignOutModalFrontstage } from "../../ui-framework/oidc/SignOut";

describe("SignOutModalFrontstage", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("should render", () => {
    const stage = new SignOutModalFrontstage(new MockAccessToken());
    const title = stage.title;
    expect(title).not.to.be.undefined;

    const wrapper = mount(stage.content as React.ReactElement<any>);
    expect(wrapper).not.to.be.undefined;
    wrapper.unmount();
  });

  it("should call onSignOut handler", () => {
    const spyMethod = sinon.spy();

    const stage = new SignOutModalFrontstage(new MockAccessToken(), spyMethod);

    const wrapper = mount(stage.content as React.ReactElement<any>);
    wrapper.find("button").simulate("click");

    spyMethod.calledOnce.should.true;
    wrapper.unmount();
  });

});
