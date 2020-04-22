/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import { mount } from "enzyme";
import { expect } from "chai";

import { Logger } from "@bentley/bentleyjs-core";
import TestUtils, { mockUserInfo } from "../TestUtils";
import { SignOutModalFrontstage } from "../../ui-framework/oidc/SignOut";

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
    wrapper.unmount();
  });

  it("should call onSignOut handler", () => {
    const spyMethod = sinon.spy(Logger, "logError");
    const stage = new SignOutModalFrontstage(mockUserInfo());

    const wrapper = mount(stage.content as React.ReactElement<any>);
    wrapper.find("button").simulate("click");
    spyMethod.calledOnce.should.true;

    wrapper.unmount();
    (Logger.logError as any).restore();
  });

});
