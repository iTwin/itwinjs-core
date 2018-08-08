/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Unmerge from "@src/zones/target/Unmerge";

describe("<Unmerge />", () => {
  it("should render", () => {
    mount(<Unmerge columns={1} rows={1} cells={[]} />);
  });

  it("renders correctly", () => {
    shallow(<Unmerge columns={1} rows={1} cells={[]} />).should.matchSnapshot();
  });
});
