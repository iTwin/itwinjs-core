/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import * as moq from "typemoq";
import { FrameworkZone } from "../../appui-react";
import { FrameworkZoneProps } from "../../appui-react/zones/FrameworkZone";

describe("FrameworkZone", () => {
  it("renders floating correctly", () => {
    const widget = moq.Mock.ofType<FrameworkZoneProps["widget"]>();
    const zone = moq.Mock.ofType<FrameworkZoneProps["zone"]>();
    const floating = moq.Mock.ofType<FrameworkZoneProps["zone"]["floating"]>();
    zone.setup((x) => x.floating).returns(() => floating.object);
    shallow(<FrameworkZone
      {...{} as FrameworkZoneProps}
      widget={widget.object}
      zone={zone.object}
    />).dive().should.matchSnapshot();
  });
});
