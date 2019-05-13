/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import * as sinon from "sinon";
import { expect } from "chai";

import TestUtils from "../TestUtils";
import { ZoneTargets } from "../../ui-framework";
import { DropTarget, WidgetZoneIndex, TargetType, MergeTarget, BackTarget } from "@bentley/ui-ninezone";

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
      const target = wrapper.find(MergeTarget);
      target.prop("onTargetChanged")!(true);
      expect(spyMethod.calledOnce).to.be.true;
      target.prop("onTargetChanged")!(false);
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
      const target = wrapper.find(BackTarget);
      target.prop("onTargetChanged")!(true);
      expect(spyMethod.calledOnce).to.be.true;
      target.prop("onTargetChanged")!(false);
      expect(spyMethod.calledTwice).to.be.true;
      wrapper.unmount();
    });
  });

});
