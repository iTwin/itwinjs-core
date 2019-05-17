/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";

import { UserProfileBackstageItem } from "../../ui-framework/backstage/UserProfile";
import TestUtils, { MockAccessToken } from "../TestUtils";
import sinon = require("sinon");
import { FrontstageManager } from "../../ui-framework";

describe("UserProfileBackstageItem", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("should render", () => {
    const wrapper = mount(<UserProfileBackstageItem accessToken={new MockAccessToken()} />);
    wrapper.unmount();
  });

  it("should open SignOut modal frontstage on click", () => {
    const spyMethod = sinon.spy();
    const wrapper = mount(<UserProfileBackstageItem accessToken={new MockAccessToken()} onOpenSignOut={spyMethod} />);

    wrapper.find(".nz-backstage-userProfile").simulate("click");
    spyMethod.calledOnce.should.true;

    wrapper.unmount();

    FrontstageManager.closeModalFrontstage();
  });

  // nz-backstage-userProfile

});
