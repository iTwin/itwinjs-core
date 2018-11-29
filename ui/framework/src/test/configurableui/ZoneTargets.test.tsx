/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import * as sinon from "sinon";
import { expect } from "chai";

import TestUtils from "../TestUtils";
import ZoneTargets from "../../configurableui/ZoneTargets";
import { DropTarget } from "@bentley/ui-ninezone/lib/zones/state/Zone";
import { WidgetZoneIndex } from "@bentley/ui-ninezone/lib/zones/state/NineZone";
import { TargetType } from "@bentley/ui-ninezone/lib/zones/state/Target";

describe("ZoneTargets", () => {
  const spyMethod = sinon.spy();
  const handler = {
    handleTargetChanged: (_zoneId: WidgetZoneIndex, _type: TargetType, _isTargeted: boolean): void => {
      spyMethod();
    },
  };

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  describe("DropTarget.Merge", () => {
    it("should render", () => {
      mount(<ZoneTargets zoneId={1} dropTarget={DropTarget.Merge} targetChangeHandler={handler} />);
    });

    it("renders correctly", () => {
      shallow(<ZoneTargets zoneId={1} dropTarget={DropTarget.Merge} targetChangeHandler={handler} />).should.matchSnapshot();
    });

    it("should call onTargetChanged", () => {
      spyMethod.resetHistory();
      const wrapper = mount(<ZoneTargets zoneId={1} dropTarget={DropTarget.Merge} targetChangeHandler={handler} />);
      const target = wrapper.find(".nz-zones-target-target");
      target.simulate("mouseenter");
      expect(spyMethod.calledOnce).to.be.true;
      target.simulate("mouseleave");
      expect(spyMethod.calledTwice).to.be.true;
      wrapper.unmount();
    });
  });

  describe("DropTarget.Back", () => {
    it("should render", () => {
      mount(<ZoneTargets zoneId={1} dropTarget={DropTarget.Back} targetChangeHandler={handler} />);
    });

    it("renders correctly", () => {
      shallow(<ZoneTargets zoneId={1} dropTarget={DropTarget.Back} targetChangeHandler={handler} />).should.matchSnapshot();
    });

    it("should call onTargetChanged", () => {
      spyMethod.resetHistory();
      const wrapper = mount(<ZoneTargets zoneId={1} dropTarget={DropTarget.Back} targetChangeHandler={handler} />);
      const target = wrapper.find(".nz-zones-target-target");
      target.simulate("mouseenter");
      expect(spyMethod.calledOnce).to.be.true;
      target.simulate("mouseleave");
      expect(spyMethod.calledTwice).to.be.true;
      wrapper.unmount();
    });
  });

});
