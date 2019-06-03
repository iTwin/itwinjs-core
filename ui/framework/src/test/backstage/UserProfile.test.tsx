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
import { AccessToken, UserInfo } from "@bentley/imodeljs-clients";

describe("UserProfileBackstageItem", () => {

  // cSpell:ignore testuser mailinator saml

  class NoUserInfoAccessToken extends AccessToken {
    public constructor() { super(); this._samlAssertion = ""; }
    public toTokenString() { return ""; }
  }

  class NoEmailProfileUserInfoAccessToken extends AccessToken {
    public constructor() { super(); this._samlAssertion = ""; }
    public getUserInfo(): UserInfo | undefined {
      const id = "596c0d8b-eac2-46a0-aa4a-b590c3314e7c";
      const organization = { id: "fefac5b-bcad-488b-aed2-df27bffe5786", name: "Bentley" };
      const featureTracking = { ultimateSite: "1004144426", usageCountryIso: "US" };
      return new UserInfo(id, undefined, undefined, organization, featureTracking);
    }

    public toTokenString() { return ""; }
  }

  class EmailArrayUserInfoAccessToken extends AccessToken {
    public constructor() { super(); this._samlAssertion = ""; }
    public getUserInfo(): UserInfo | undefined {
      const id = "596c0d8b-eac2-46a0-aa4a-b590c3314e7c";
      const email = { id: ["testuser001@mailinator.com"] as unknown as string };
      const organization = { id: "fefac5b-bcad-488b-aed2-df27bffe5786", name: "Bentley" };
      const featureTracking = { ultimateSite: "1004144426", usageCountryIso: "US" };
      return new UserInfo(id, email, undefined, organization, featureTracking);
    }

    public toTokenString() { return ""; }
  }

  class EmailEmptyArrayUserInfoAccessToken extends AccessToken {
    public constructor() { super(); this._samlAssertion = ""; }
    public getUserInfo(): UserInfo | undefined {
      const id = "596c0d8b-eac2-46a0-aa4a-b590c3314e7c";
      const email = { id: [] as unknown as string };
      const organization = { id: "fefac5b-bcad-488b-aed2-df27bffe5786", name: "Bentley" };
      const featureTracking = { ultimateSite: "1004144426", usageCountryIso: "US" };
      return new UserInfo(id, email, undefined, organization, featureTracking);
    }

    public toTokenString() { return ""; }
  }

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("should render", () => {
    const wrapper = mount(<UserProfileBackstageItem accessToken={new MockAccessToken()} />);
    wrapper.unmount();
  });

  it("should render with an AccessToken with no UserInfo", () => {
    const wrapper = mount(<UserProfileBackstageItem accessToken={new NoUserInfoAccessToken()} />);
    wrapper.unmount();
  });

  it("should render with an AccessToken with no Email or Profile", () => {
    const wrapper = mount(<UserProfileBackstageItem accessToken={new NoEmailProfileUserInfoAccessToken()} />);
    wrapper.unmount();
  });

  it("should render with an AccessToken with Email array", () => {
    const wrapper = mount(<UserProfileBackstageItem accessToken={new EmailArrayUserInfoAccessToken()} />);
    wrapper.unmount();
  });

  it("should render with an AccessToken with empty Email array", () => {
    const wrapper = mount(<UserProfileBackstageItem accessToken={new EmailEmptyArrayUserInfoAccessToken()} />);
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
