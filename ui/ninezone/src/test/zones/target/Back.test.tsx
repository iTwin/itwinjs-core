/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { BackTarget } from "../../../ui-ninezone";

describe("<BackTarget />", () => {
  it("should render", () => {
    mount(<BackTarget zoneIndex={9} />);
  });

  it("renders correctly", () => {
    shallow(<BackTarget zoneIndex={9} />).should.matchSnapshot();
  });
});
