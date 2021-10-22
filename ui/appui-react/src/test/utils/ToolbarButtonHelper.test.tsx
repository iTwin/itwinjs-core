/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import { Direction, Toolbar } from "@itwin/appui-layout-react";
import { render } from "@testing-library/react";
import { CommandItemDef, GroupButton, ToolbarButtonHelper, ToolButton, ToolWidget } from "../../appui-react";
import TestUtils from "../TestUtils";

describe("Locate Toolbar items", () => {
  const tool1 = new CommandItemDef({
    commandId: "tool1",
    iconSpec: "icon-placeholder",
    label: "SampleApp:group:tool1",
  });

  const tool2 = new CommandItemDef({
    commandId: "tool2",
    iconSpec: "icon-placeholder",
    applicationData: { key: "value" },
  });

  const backstageToggleCommand =
    new CommandItemDef({
      commandId: "SampleApp.BackstageToggle",
      iconSpec: "icon-home",
      execute: () => { },
    });

  let horizontalToolbar: React.ReactNode;
  let verticalToolbar: React.ReactNode;

  before(async () => {
    await TestUtils.initializeUiFramework();

    // Set in the before() after UiFramework.i18n is initialized
    horizontalToolbar =
      <Toolbar
        expandsTo={Direction.Bottom}
        items={
          <>
            <ToolButton toolId="tool1" iconSpec="icon-placeholder" label="SampleApp:buttons.tool1" />
          </>
        }
      />;

    verticalToolbar =
      <Toolbar
        expandsTo={Direction.Right}
        items={
          <>
            <ToolButton toolId="tool2" iconSpec="icon-placeholder" label="SampleApp:buttons.tool2" />
            <GroupButton
              label="SampleApp:group"
              iconSpec="icon-placeholder"
              items={[tool1, tool2]}
            />
          </>
        }
      />;

  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("Find item in horizontal and vertical toolbars.", () => {
    const component = render(
      <ToolWidget // eslint-disable-line deprecation/deprecation
        appButton={backstageToggleCommand}
        horizontalToolbar={horizontalToolbar}
        verticalToolbar={verticalToolbar}
      />,
    );

    expect(component).not.to.be.null;

    const foundHorizontalToolbarItem = ToolbarButtonHelper.searchHorizontalToolbarsByTitle("SampleApp:buttons.tool1");
    expect(foundHorizontalToolbarItem).not.to.be.null;

    const foundGroupToolbarItem = ToolbarButtonHelper.searchVerticalToolbarsByTitle("SampleApp:group");
    expect(foundGroupToolbarItem).not.to.be.null;

    const foundVerticalToolbarItem = ToolbarButtonHelper.getToolbarButtonByTitle("SampleApp:buttons.tool2");
    expect(foundVerticalToolbarItem).not.to.be.null;

    const foundAppButton = ToolbarButtonHelper.getAppButton();
    expect(foundAppButton).not.to.be.null;
  });
});
