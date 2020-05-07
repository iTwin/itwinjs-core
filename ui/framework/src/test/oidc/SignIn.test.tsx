/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { SignIn } from "../../ui-framework/oidc/SignIn";
import TestUtils from "../TestUtils";

describe("SignIn", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("should render", () => {
    const spyMethod = sinon.spy();
    const wrapper = mount(<SignIn onSignedIn={spyMethod} />);
    expect(wrapper).not.to.be.undefined;
    wrapper.unmount();
  });

  it("should handle signIn button click", () => {
    const spyMethod = sinon.spy();
    const wrapper = mount(<SignIn onSignedIn={() => { }} onStartSignIn={spyMethod} />);
    expect(wrapper).not.to.be.undefined;

    wrapper.find("button.components-signin-button").simulate("click");
    spyMethod.calledOnce.should.true;

    wrapper.unmount();
  });

});
