/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";
import * as sinon from "sinon";
import TestUtils from "../TestUtils";
import { SignIn } from "../../ui-framework/oidc/SignIn";

describe("SignIn", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("should render", () => {
    const spyMethod = sinon.spy();
    const wrapper = mount(<SignIn onSignedIn={spyMethod} />);
    expect(wrapper).not.to.be.undefined;
    wrapper.unmount();
  });

});
