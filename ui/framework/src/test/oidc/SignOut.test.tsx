/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";
import TestUtils from "../TestUtils";
import { SignOutModalFrontstage } from "../../ui-framework/oidc/SignOut";
import { AccessToken, UserInfo } from "@bentley/imodeljs-clients";

class MockAccessToken extends AccessToken {
  public constructor() { super(""); }
  public getUserInfo(): UserInfo | undefined {
    const id = "596c0d8b-eac2-46a0-aa4a-b590c3314e7c";
    const email = { id: "testuser001@mailinator.com" };
    const profile = { firstName: "test", lastName: "user" };
    const organization = { id: "fefac5b-bcad-488b-aed2-df27bffe5786", name: "Bentley" };
    const featureTracking = { ultimateSite: "1004144426", usageCountryIso: "US" };
    return new UserInfo(id, email, profile, organization, featureTracking);
  }

  public toTokenString() { return ""; }
}
describe("SignOutModalFrontstage", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("should render", () => {
    const stage = new SignOutModalFrontstage(new MockAccessToken());
    const title = stage.title;
    expect(title).not.to.be.undefined;

    const wrapper = mount(stage.content as React.ReactElement<any>);
    expect(wrapper).not.to.be.undefined;
    wrapper.unmount();
  });

});
