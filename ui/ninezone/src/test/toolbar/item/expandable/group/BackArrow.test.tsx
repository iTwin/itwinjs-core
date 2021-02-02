/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import * as useTargetedModule from "@bentley/ui-core/lib/ui-core/utils/hooks/useTargeted";
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
    sinon.stub(useTargetedModule, "useTargeted").returns(true);
    shallow(<BackArrow />).dive().should.matchSnapshot();
  });
});
