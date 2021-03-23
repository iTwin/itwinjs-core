/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import enzyme from "enzyme"; const { mount } = enzyme;
import * as React from "react";
import * as sinon from "sinon";
import { SignIn } from "../../ui-components/oidc/SignIn.js";
import TestUtils from "../TestUtils.js";

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
    const wrapper = mount(<SignIn onSignIn={spyMethod} signingInMessage="Signing in ..." />);
    expect(wrapper).not.to.be.undefined;

    wrapper.find("button.components-signin-button").simulate("click");
    expect(spyMethod.calledOnce).to.be.true;

    wrapper.unmount();
  });

  it("should handle signIn on space key", () => {
    const spyMethod = sinon.spy();
    const wrapper = mount(<SignIn onSignIn={spyMethod} signingInMessage="Signing in ..." />);
    expect(wrapper).not.to.be.undefined;

    wrapper.find("button.components-signin-button").simulate("keyup", { key: "Enter" });
    wrapper.find("button.components-signin-button").simulate("keyup", { key: " " });
    expect(spyMethod.calledTwice).to.be.true;

    wrapper.unmount();
  });

  it("should not handle signIn button click if disabled", () => {
    const spyMethod = sinon.spy();
    const wrapper = mount(<SignIn onSignIn={spyMethod} disableSignInOnClick />);
    expect(wrapper).not.to.be.undefined;

    wrapper.find("button.components-signin-button").simulate("click");
    expect(spyMethod.calledOnce).to.be.true;
    wrapper.update();

    wrapper.find("button.components-signin-button").simulate("click");
    expect(spyMethod.calledTwice).to.be.false;

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

  it("should handle offline button on space key", () => {
    const spyMethod = sinon.spy();
    const offlineSpy = sinon.spy();
    const wrapper = mount(<SignIn onSignIn={spyMethod} onOffline={offlineSpy} />);
    expect(wrapper).not.to.be.undefined;

    wrapper.find("a.components-signin-offline").simulate("keyup", { key: "Enter" });
    wrapper.find("a.components-signin-offline").simulate("keyup", { key: " " });
    expect(offlineSpy.calledTwice).to.be.true;

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

  it("should handle offline button on space key", () => {
    const spyMethod = sinon.spy();
    const registerSpy = sinon.spy();
    const wrapper = mount(<SignIn onSignIn={spyMethod} onRegister={registerSpy} />);
    expect(wrapper).not.to.be.undefined;

    const span = wrapper.find("span.components-signin-register");
    span.find("a").simulate("keyup", { key: "Enter" });
    span.find("a").simulate("keyup", { key: " " });
    expect(registerSpy.calledTwice).to.be.true;

    wrapper.unmount();
  });

});
