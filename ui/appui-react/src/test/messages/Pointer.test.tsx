/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { NotifyMessageDetails, OutputMessagePriority, OutputMessageType } from "@itwin/core-frontend";
import { RelativePosition } from "@itwin/appui-abstract";
import { AppNotificationManager, PointerMessage } from "../../appui-react";
import TestUtils, { selectorMatches } from "../TestUtils";
import { render, screen } from "@testing-library/react";

describe("PointerMessage", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  let notifications: AppNotificationManager;
  let details: NotifyMessageDetails;
  const viewport = document.activeElement as HTMLElement;
  const point = { x: 0, y: 0 };

  beforeEach(() => {
    notifications = new AppNotificationManager();
    details = new NotifyMessageDetails(OutputMessagePriority.None, "Brief", "Detailed", OutputMessageType.Pointer);
  });

  it("should display the message", () => {
    render(<PointerMessage  />);

    notifications.outputMessage(details);

    expect(screen.getByText("Brief")).to.satisfy(selectorMatches(".uifw-pointer-message .nz-content .uifw-pointer-message-content .uifw-pointer-message-text .uifw-pointer-message-brief"));
  });

  it("should hide the message", () => {
    const hideMessage = sinon.spy(PointerMessage, "hideMessage");
    notifications.closePointerMessage();
    expect(hideMessage.called).to.be.true;
  });

  it("should display a warning message", () => {
    const showMessage = sinon.spy(PointerMessage, "showMessage");
    const localDetails = new NotifyMessageDetails(OutputMessagePriority.Warning, "Brief", "Detailed", OutputMessageType.Pointer);
    notifications.outputMessage(localDetails);
    expect(showMessage.called).to.be.true;
  });

  it("should display an error message", () => {
    const showMessage = sinon.spy(PointerMessage, "showMessage");
    const localDetails = new NotifyMessageDetails(OutputMessagePriority.Error, "Brief", "Detailed", OutputMessageType.Pointer);
    notifications.outputMessage(localDetails);
    expect(showMessage.called).to.be.true;
  });

  it("should offset the message", () => {
    render(<PointerMessage />);
    details.setPointerTypeDetails(viewport, point, RelativePosition.Top);
    notifications.outputMessage(details);

    details.setPointerTypeDetails(viewport, point, RelativePosition.TopRight);
    notifications.outputMessage(details);

    details.setPointerTypeDetails(viewport, point, RelativePosition.Right);
    notifications.outputMessage(details);

    details.setPointerTypeDetails(viewport, point, RelativePosition.BottomRight);
    notifications.outputMessage(details);

    details.setPointerTypeDetails(viewport, point, RelativePosition.Bottom);
    notifications.outputMessage(details);

    details.setPointerTypeDetails(viewport, point, RelativePosition.BottomLeft);
    notifications.outputMessage(details);

    details.setPointerTypeDetails(viewport, point, RelativePosition.Left);
    notifications.outputMessage(details);

    details.setPointerTypeDetails(viewport, point, RelativePosition.TopLeft);
    notifications.outputMessage(details);
  });

  it("should update the message", () => {
    const updateMessage = sinon.spy(PointerMessage, "updateMessage");
    render(<PointerMessage  />);
    notifications.updatePointerMessage({ x: 1, y: 1 }, RelativePosition.BottomRight);
    expect(updateMessage.called).to.be.true;
  });
});
