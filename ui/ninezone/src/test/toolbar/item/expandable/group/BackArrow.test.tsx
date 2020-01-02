/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { BackArrow } from "../../../../../ui-ninezone";
import * as useTargetedModule from "../../../../../ui-ninezone/base/useTargeted";

describe("<BackArrow />", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", () => {
    mount(<BackArrow />);
  });

  it("renders correctly", () => {
    shallow(<BackArrow />).dive().should.matchSnapshot();
  });

  it("renders targeted correctly", () => {
    sandbox.stub(useTargetedModule, "useTargeted").returns(true);
    shallow(<BackArrow />).dive().should.matchSnapshot();
  });
});
