/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
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
    shallow(<Button type={ButtonType.Blue} />).should.matchSnapshot();
  });

  it("should render hollow", () => {
    shallow(<Button type={ButtonType.Hollow} />).should.matchSnapshot();
  });

  it("should render primary", () => {
    shallow(<Button type={ButtonType.Primary} />).should.matchSnapshot();
  });

  it("should render disabled", () => {
    shallow(<Button type={ButtonType.Disabled} />).should.matchSnapshot();
  });

  it("should render large", () => {
    shallow(<Button size={ButtonSize.Large} />).should.matchSnapshot();
  });
});
