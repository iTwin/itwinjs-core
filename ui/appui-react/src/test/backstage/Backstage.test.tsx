/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { MockRender } from "@itwin/core-frontend";
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import {
  Backstage, UiFramework,
} from "../../appui-react";
import TestUtils, { selectorMatches, userEvent } from "../TestUtils";

/* eslint-disable deprecation/deprecation */
describe("Backstage", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();

    await UiFramework.frontstages.setActiveFrontstageDef(undefined);
    UiFramework.events.initialize();   // To process Backstage events
    await MockRender.App.startup();
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  describe("<Backstage />", () => {
    it("renders correctly - isVisible", () => {
      render(<Backstage isVisible={true} />);

      expect(screen.getByRole("menu")).to.satisfy(selectorMatches(".nz-backstage-backstage.nz-open ul"));
      expect(screen.getByRole("presentation")).to.satisfy(selectorMatches(".nz-backstage-backstage_overlay.nz-open"));
    });

    it("renders correctly - !isVisible", () => {
      render(<Backstage isVisible={false} />);

      expect(screen.getByRole("menu")).to.satisfy(selectorMatches(".nz-backstage-backstage ul")).and.not.satisfy(selectorMatches(".nz-open ul"));
      expect(screen.getByRole("presentation")).to.satisfy(selectorMatches(".nz-backstage-backstage_overlay")).and.not.satisfy(selectorMatches(".nz-open"));
    });

    it("renders correctly with header", () => {
      render(<Backstage header={<div> Hello World! </div>} />);

      expect(screen.getByText("Hello World!")).to.satisfy(selectorMatches(".nz-backstage-backstage .nz-header div"));
    });

    it("with child items", () => {
      render(
        <Backstage isVisible={true}>
          <div>Content</div>
        </Backstage>,
      );
      expect(screen.getByText("Content")).to.satisfy(selectorMatches(".nz-backstage-backstage ul div"));
    });

    it("should show", () => {
      render(<Backstage isVisible={false} />);
      expect(Backstage.isBackstageVisible).to.be.false;
      Backstage.show();
      expect(Backstage.isBackstageVisible).to.be.true;
    });

    it("should hide", () => {
      render(<Backstage isVisible={true} />);
      expect(Backstage.isBackstageVisible).to.be.true;
      Backstage.hide();
      expect(Backstage.isBackstageVisible).to.be.false;
    });

    it("should toggle", () => {
      render(<Backstage isVisible={false} />);
      expect(Backstage.isBackstageVisible).to.be.false;

      const toggleCommand = Backstage.backstageToggleCommand;
      toggleCommand.execute();
      expect(Backstage.isBackstageVisible).to.be.true;

      toggleCommand.execute();
      expect(Backstage.isBackstageVisible).to.be.false;
    });

    it("should show by updating isVisible prop", () => {
      const {rerender} = render(<Backstage isVisible={false} />);
      expect(Backstage.isBackstageVisible).to.be.false;
      rerender(<Backstage isVisible={true} />);
      expect(Backstage.isBackstageVisible).to.be.true;
    });

    it("should close when clicking the overlay", async () => {
      const theUserTo = userEvent.setup();
      const spyMethod = sinon.spy();
      render(<Backstage isVisible={true} onClose={spyMethod} />);

      await theUserTo.click(screen.getByRole("presentation"));

      expect(Backstage.isBackstageVisible).to.be.false;
      expect(spyMethod.calledOnce).to.be.true;
    });
  });
});
