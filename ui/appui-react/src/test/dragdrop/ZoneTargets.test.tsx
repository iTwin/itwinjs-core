/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import type { WidgetZoneId} from "@itwin/appui-layout-react";
import { BackTarget, MergeTarget, ZoneTargetType } from "@itwin/appui-layout-react";
import { ZoneTargets } from "../../appui-react/dragdrop/ZoneTargets";
import TestUtils, { mount } from "../TestUtils";

describe("ZoneTargets", () => {
  const spyMethod = sinon.spy();
  const handler = {
    // eslint-disable-next-line deprecation/deprecation
    handleTargetChanged: (_zoneId: WidgetZoneId, _type: ZoneTargetType, _isTargeted: boolean): void => {
      spyMethod();
    },
  };

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  describe("DropTarget.Merge", () => {
    it("should render", () => {
      // eslint-disable-next-line deprecation/deprecation
      mount(<ZoneTargets zoneId={1} dropTarget={ZoneTargetType.Merge} targetChangeHandler={handler} />);
    });

    it("renders correctly", () => {
      // eslint-disable-next-line deprecation/deprecation
      shallow(<ZoneTargets zoneId={1} dropTarget={ZoneTargetType.Merge} targetChangeHandler={handler} />).should.matchSnapshot();
    });

    it("should call onTargetChanged", () => {
      spyMethod.resetHistory();
      // eslint-disable-next-line deprecation/deprecation
      const wrapper = mount(<ZoneTargets zoneId={1} dropTarget={ZoneTargetType.Merge} targetChangeHandler={handler} />);
      const target = wrapper.find(MergeTarget);
      target.prop("onTargetChanged")!(true);
      expect(spyMethod.calledOnce).to.be.true;
      target.prop("onTargetChanged")!(false);
      expect(spyMethod.calledTwice).to.be.true;
    });
  });

  describe("DropTarget.Back", () => {
    it("should render", () => {
      // eslint-disable-next-line deprecation/deprecation
      mount(<ZoneTargets zoneId={1} dropTarget={ZoneTargetType.Back} targetChangeHandler={handler} />);
    });

    it("renders correctly", () => {
      // eslint-disable-next-line deprecation/deprecation
      shallow(<ZoneTargets zoneId={1} dropTarget={ZoneTargetType.Back} targetChangeHandler={handler} />).should.matchSnapshot();
    });

    it("should call onTargetChanged", () => {
      spyMethod.resetHistory();
      // eslint-disable-next-line deprecation/deprecation
      const wrapper = mount(<ZoneTargets zoneId={1} dropTarget={ZoneTargetType.Back} targetChangeHandler={handler} />);
      const target = wrapper.find(BackTarget);
      target.prop("onTargetChanged")!(true);
      expect(spyMethod.calledOnce).to.be.true;
      target.prop("onTargetChanged")!(false);
      expect(spyMethod.calledTwice).to.be.true;
    });
  });

});
