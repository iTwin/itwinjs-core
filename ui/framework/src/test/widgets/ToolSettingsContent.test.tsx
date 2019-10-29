/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { HorizontalAnchor, ToolSettingsWidgetMode } from "@bentley/ui-ninezone";
import { ToolSettingsContent } from "../../ui-framework/widgets/ToolSettingsContent";

describe("ToolSettingsContent", () => {
  it("should render in tab mode", () => {
    shallow(<ToolSettingsContent
      anchor={HorizontalAnchor.Left}
      mode={ToolSettingsWidgetMode.Tab}
    />);
  });

  it("should render in title bar mode", () => {
    shallow(<ToolSettingsContent
      anchor={HorizontalAnchor.Left}
      mode={ToolSettingsWidgetMode.TitleBar}
    />);
  });
});
