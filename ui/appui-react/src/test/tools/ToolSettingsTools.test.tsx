/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { render } from "@testing-library/react";
import { expect } from "chai";
import { MockRender } from "@itwin/core-frontend";
import { TestUtils } from "../TestUtils";
import { BumpToolSetting, FocusToolSettings } from "../../appui-react/tools/ToolSettingsTools";

describe("ToolSettingsTools", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
    await MockRender.App.startup();
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  describe("FocusToolSettings", () => {
    it("should return false if no ToolSettings div found", async () => {
      render(<div data-testid="div"></div>);
      const tool = new FocusToolSettings();
      expect(await tool.parseAndRun()).to.be.false;
    });

    it("should return true if focusable item in docked ToolSettings", async () => {
      render(<div className="nz-toolSettings-docked"><button /></div>);
      const tool = new FocusToolSettings();
      expect(await tool.parseAndRun()).to.be.true;
    });
  });

  describe("BumpToolSetting", () => {
    it("should return true if no args", async () => {
      const tool = new BumpToolSetting();
      expect(await tool.parseAndRun()).to.be.true;
    });

    it("should return true if valid arg", async () => {
      const tool = new BumpToolSetting();
      expect(await tool.parseAndRun("2")).to.be.true;
    });

    it("should return false if invalid arg", async () => {
      const tool = new BumpToolSetting();
      expect(await tool.parseAndRun("bad")).to.be.false;
    });

  });

});
