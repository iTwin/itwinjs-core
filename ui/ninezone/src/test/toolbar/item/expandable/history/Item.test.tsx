/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { HistoryItem } from "../../../../../ui-ninezone";

describe("<HistoryItem />", () => {
  it("should render", () => {
    mount(<HistoryItem />);
  });

  it("renders correctly", () => {
    shallow(<HistoryItem />).should.matchSnapshot();
  });

  it("renders active", () => {
    shallow(<HistoryItem isActive />).should.matchSnapshot();
  });
});
