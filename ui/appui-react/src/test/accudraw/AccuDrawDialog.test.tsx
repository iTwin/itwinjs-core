/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { fireEvent, render } from "@testing-library/react";
import * as sinon from "sinon";
import * as React from "react";
import type { IModelAppOptions} from "@itwin/core-frontend";
import { CompassMode, IModelApp, MockRender } from "@itwin/core-frontend";
import { SpecialKey } from "@itwin/appui-abstract";
import { Orientation } from "@itwin/core-react";
import { TestUtils } from "../TestUtils";
import { FrameworkAccuDraw } from "../../appui-react/accudraw/FrameworkAccuDraw";
import { AccuDrawDialog } from "../../appui-react/accudraw/AccuDrawDialog";
import { KeyboardShortcutManager } from "../../appui-react/keyboardshortcut/KeyboardShortcut";

describe("AccuDrawDialog", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();

    const opts: IModelAppOptions = {};
    opts.accuDraw = new FrameworkAccuDraw();
    await MockRender.App.startup(opts);
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  it("should render Rectangular", () => {
    IModelApp.accuDraw.setCompassMode(CompassMode.Rectangular);
    render(<AccuDrawDialog opened={true} dialogId="accudraw" />);
  });

  it("should render Polar", () => {
    IModelApp.accuDraw.setCompassMode(CompassMode.Polar);
    render(<AccuDrawDialog opened={true} dialogId="accudraw" orientation={Orientation.Horizontal} />);
  });

  it("should set focus to Home on Esc key", () => {
    const spy = sinon.spy(KeyboardShortcutManager, "setFocusToHome");
    const component = render(<AccuDrawDialog opened={true} dialogId="accudraw" />);

    component.baseElement.dispatchEvent(new KeyboardEvent("keyup", { key: SpecialKey.Escape }));
    spy.calledOnce.should.true;

    (KeyboardShortcutManager.setFocusToHome as any).restore();
  });

  it("should call onClose on close", () => {
    const spy = sinon.spy();
    const component = render(<AccuDrawDialog opened={true} dialogId="accudraw" onClose={spy} />);

    const closeButton = component.getByTestId("core-dialog-close");
    fireEvent.click(closeButton);
    spy.calledOnce.should.true;
  });

});
