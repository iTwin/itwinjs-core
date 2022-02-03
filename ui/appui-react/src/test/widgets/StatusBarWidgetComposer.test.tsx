/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import type * as React from "react";
import * as sinon from "sinon";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import {
  WidgetState,
} from "@itwin/appui-abstract";
import { render } from "@testing-library/react";
import type { StatusBarWidgetControl, StatusBarWidgetControlArgs} from "../../appui-react";
import {
  ConfigurableUiControlType, FrontstageManager, StatusBarWidgetComposerControl, WidgetDef,
} from "../../appui-react";
import TestUtils from "../TestUtils";

describe("StatusBarComposerControl", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
    await NoRenderApp.startup();
  });

  after(async () => {
    TestUtils.terminateUiFramework();
    await IModelApp.shutdown();
  });

  it("will render empty status bar", async () => {
    const statusBarWidgetDef = new WidgetDef({
      classId: StatusBarWidgetComposerControl,
      defaultState: WidgetState.Open,
      isFreeform: false,
      isStatusBar: true,
    });
    const statusBarControl = statusBarWidgetDef.getWidgetControl(ConfigurableUiControlType.StatusBarWidget) as StatusBarWidgetControl;
    sinon.stub(FrontstageManager, "activeFrontstageId").returns("TestStage");
    const node = statusBarControl.getReactNode({} as StatusBarWidgetControlArgs);
    const renderedComponent = render(node as React.ReactElement);
    expect(renderedComponent).not.to.be.undefined;
  });
});
