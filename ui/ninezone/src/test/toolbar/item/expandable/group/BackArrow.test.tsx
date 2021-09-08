/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useTargeted } from "@bentley/ui-core";
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { BackArrow } from "../../../../../ui-ninezone";
import { mount } from "../../../../Utils";

describe("<BackArrow />", () => {
  it("should render", () => {
    mount(<BackArrow />);
  });

  it("renders correctly", () => {
    shallow(<BackArrow />).dive().should.matchSnapshot();
  });

  it("renders targeted correctly", () => {
    sinon.stub(useTargeted as any, "useTargeted").returns(true);
    shallow(<BackArrow />).dive().should.matchSnapshot();
  });
});
