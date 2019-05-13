/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { Button, ButtonType, ButtonSize } from "../../ui-core/button/Button";

describe("<Button />", () => {
  it("should render", () => {
    mount(<Button />);
  });

  it("renders correctly", () => {
    shallow(<Button />).should.matchSnapshot();
  });

  it("with children renders correctly", () => {
    shallow(<Button>children</Button>).should.matchSnapshot();
  });

  it("disabled renders correctly", () => {
    shallow(<Button disabled>Label</Button>).should.matchSnapshot();
  });

  it("should render blue", () => {
    shallow(<Button buttonType={ButtonType.Blue} />).should.matchSnapshot();
  });

  it("should render hollow", () => {
    shallow(<Button buttonType={ButtonType.Hollow} />).should.matchSnapshot();
  });

  it("should render primary", () => {
    shallow(<Button buttonType={ButtonType.Primary} />).should.matchSnapshot();
  });

  it("should render disabled", () => {
    shallow(<Button buttonType={ButtonType.Disabled} />).should.matchSnapshot();
  });

  it("should render large", () => {
    shallow(<Button size={ButtonSize.Large} />).should.matchSnapshot();
  });
});
