/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { Back } from "../../../ui-ninezone";

describe("<Back />", () => {
  it("should render", () => {
    mount(<Back zoneIndex={9} />);
  });

  it("renders correctly", () => {
    shallow(<Back zoneIndex={9} />).should.matchSnapshot();
  });
});
