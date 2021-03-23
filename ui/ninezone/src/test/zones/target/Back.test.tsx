/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { shallow } = enzyme;
import * as React from "react";
import { BackTarget } from "../../../ui-ninezone.js";
import { mount } from "../../Utils.js";

describe("<BackTarget />", () => {
  it("should render", () => {
    mount(<BackTarget zoneIndex={9} />);
  });

  it("renders correctly", () => {
    shallow(<BackTarget zoneIndex={9} />).should.matchSnapshot();
  });
});
