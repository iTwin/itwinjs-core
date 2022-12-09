/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { WidgetZoneId, ZoneTargetType } from "@itwin/appui-layout-react";
import { ZoneTargets } from "../../appui-react/dragdrop/ZoneTargets";
import TestUtils, { userEvent } from "../TestUtils";
import { render } from "@testing-library/react";
/* eslint-disable deprecation/deprecation */
describe("ZoneTargets", () => {
  const spyMethod = sinon.spy();
  const handler = {
    handleTargetChanged: (_zoneId: WidgetZoneId, _type: ZoneTargetType, _isTargeted: boolean): void => {
      spyMethod();
    },
  };
  let theUserTo: ReturnType<typeof userEvent.setup>;
  beforeEach(()=>{
    theUserTo = userEvent.setup();
  });

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  describe("DropTarget.Merge", () => {
    it("should call onTargetChanged", async () => {
      const {container} = render(<ZoneTargets zoneId={1} dropTarget={ZoneTargetType.Merge} targetChangeHandler={handler} />);

      await theUserTo.hover(container.querySelector(".nz-zone-6")!);
      expect(spyMethod.calledOnce).to.be.true;

      await theUserTo.unhover(container.querySelector(".nz-zone-6")!);
      expect(spyMethod.calledTwice).to.be.true;
    });
  });

  describe("DropTarget.Back", () => {
    it("should call onTargetChanged", async () => {
      spyMethod.resetHistory();
      const {container} = render(<ZoneTargets zoneId={1} dropTarget={ZoneTargetType.Back} targetChangeHandler={handler} />);

      await theUserTo.hover(container.querySelector(".nz-zone-1")!);
      expect(spyMethod.calledOnce).to.be.true;

      await theUserTo.unhover(container.querySelector(".nz-zone-1")!);
      expect(spyMethod.calledTwice).to.be.true;
    });
  });

});
