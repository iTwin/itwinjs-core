/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { SearchBox } from "@src/index";
import TestUtils from "../TestUtils";

describe("SearchBox", () => {

  before(async () => {
    await TestUtils.initializeUiCore();
  });

  describe("<SearchBox />", () => {
    it("should render", () => {
      mount(<SearchBox onValueChanged={() => { }} />);
    });

    it("renders correctly", () => {
      shallow(<SearchBox onValueChanged={() => { }} />).should.matchSnapshot();
    });
  });
});
