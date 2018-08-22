/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { StandardRotationNavigationAid } from "../../../src/index";
import TestUtils from "../../TestUtils";

describe("StandardRotationNavigationAid", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  describe("<StandardRotationNavigationAid />", () => {
    it("should render", () => {
      mount(<StandardRotationNavigationAid />);
    });
    it("renders correctly", () => {
      shallow(<StandardRotationNavigationAid />).should.matchSnapshot();
    });
  });
});
