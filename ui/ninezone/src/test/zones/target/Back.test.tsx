/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { BackTarget } from "../../../ui-ninezone";
import { mount } from "../../Utils";

describe("<BackTarget />", () => {
  it("should render", () => {
    mount(<BackTarget zoneIndex={9} />);
  });

  it("renders correctly", () => {
    shallow(<BackTarget zoneIndex={9} />).should.matchSnapshot();
  });
});
