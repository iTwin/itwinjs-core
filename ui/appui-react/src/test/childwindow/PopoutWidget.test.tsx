/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { render } from "@testing-library/react";
import { WidgetState } from "@itwin/appui-abstract";
import TestUtils from "../TestUtils";
import { PopoutWidget } from "../../appui-react/childwindow/PopoutWidget";
import { WidgetDef } from "../../appui-react/widgets/WidgetDef";

describe("PopoutWidget", () => {
  const sandbox = sinon.createSandbox();
  const testWidgetDef = new WidgetDef({
    classId: "test",
    defaultState: WidgetState.Open,
    isFreeform: false,
    isStatusBar: false,
  });

  afterEach(async () => {
    sandbox.restore();
  });

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("will render", () => {
    sandbox.stub(testWidgetDef, "reactNode").get(() => <div>Hello</div>);
    const renderedComponent = render(<PopoutWidget widgetContainerId="testContainer" widgetDef={testWidgetDef} />);
    expect(renderedComponent.queryByText("Hello")).not.to.be.null;
    renderedComponent.unmount();
  });
});
