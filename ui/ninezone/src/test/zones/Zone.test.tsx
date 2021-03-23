/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import enzyme from "enzyme"; const { shallow } = enzyme;
import * as React from "react";
import { SafeAreaInsets, Zone } from "../../ui-ninezone.js";
import { mount } from "../Utils.js";

describe("<Zone />", () => {
  it("should render", () => {
    mount(<Zone id={1} />);
  });

  it("renders correctly", () => {
    shallow(<Zone id={1} />).should.matchSnapshot();
  });

  it("renders correctly positioned", () => {
    mount(<Zone id={1} bounds={{ bottom: 10, left: 0, right: 10, top: 0 }} />);
  });

  it("renders correctly in footer mode", () => {
    shallow(<Zone id={1} isInFooterMode />).should.matchSnapshot();
  });

  it("renders floating correctly", () => {
    shallow(<Zone id={1} isFloating />).should.matchSnapshot();
  });

  it("renders hidden correctly", () => {
    shallow(<Zone id={1} isHidden />).should.matchSnapshot();
  });

  it("renders safe area aware correctly", () => {
    shallow(<Zone id={1} safeAreaInsets={SafeAreaInsets.All} />).should.matchSnapshot();
  });
});
