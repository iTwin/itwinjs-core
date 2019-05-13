/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";
import * as sinon from "sinon";
import TestUtils from "../TestUtils";
import { SignIn } from "../../ui-components/oidc/SignIn";

describe("SignIn", () => {

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  it("should render", () => {
    const spyMethod = sinon.spy();
    const wrapper = mount(<SignIn onSignIn={spyMethod} />);
    expect(wrapper).not.to.be.undefined;
    wrapper.unmount();
  });

  it("should handle signIn button click", () => {
    const spyMethod = sinon.spy();
    const wrapper = mount(<SignIn onSignIn={spyMethod} />);
    expect(wrapper).not.to.be.undefined;

    wrapper.find("button.components-signin-button").simulate("click");
    expect(spyMethod.calledOnce).to.be.true;

    wrapper.unmount();
  });

  it("should handle offline button click", () => {
    const spyMethod = sinon.spy();
    const offlineSpy = sinon.spy();
    const wrapper = mount(<SignIn onSignIn={spyMethod} onOffline={offlineSpy} />);
    expect(wrapper).not.to.be.undefined;

    wrapper.find("a.components-signin-offline").simulate("click");
    expect(offlineSpy.calledOnce).to.be.true;

    wrapper.unmount();
  });

  it("should handle offline button click", () => {
    const spyMethod = sinon.spy();
    const registerSpy = sinon.spy();
    const wrapper = mount(<SignIn onSignIn={spyMethod} onRegister={registerSpy} />);
    expect(wrapper).not.to.be.undefined;

    const span = wrapper.find("span.components-signin-register");
    span.find("a").simulate("click");
    expect(registerSpy.calledOnce).to.be.true;

    wrapper.unmount();
  });

});
