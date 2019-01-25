/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as enzyme from "enzyme";
import * as sinon from "sinon";
import TestUtils from "../TestUtils";
import { PointerMessage, AppNotificationManager } from "../../ui-framework";
import { NotifyMessageDetails, OutputMessagePriority, OutputMessageType, RelativePosition } from "@bentley/imodeljs-frontend";

describe("PointerMessage", () => {
  let showMessage: sinon.SinonSpy;
  let hideMessage: sinon.SinonSpy;

  before(async () => {
    await TestUtils.initializeUiFramework();

    showMessage = sinon.spy(PointerMessage, "showMessage");
    hideMessage = sinon.spy(PointerMessage, "hideMessage");
  });

  let notifications: AppNotificationManager;
  let details: NotifyMessageDetails;
  const viewport = document.activeElement as HTMLElement;
  const point = { x: 0, y: 0 };

  beforeEach(() => {
    notifications = new AppNotificationManager();
    details = new NotifyMessageDetails(OutputMessagePriority.None, "Brief", "Detailed", OutputMessageType.Pointer);
  });

  it("should render correctly", () => {
    enzyme.shallow(
      <PointerMessage />,
    ).should.matchSnapshot();
  });

  it("should display the message", () => {
    showMessage.resetHistory();
    notifications.outputMessage(details);
    expect(showMessage.called).to.be.true;
  });

  it("should hide the message", () => {
    notifications.closePointerMessage();
    expect(hideMessage.called).to.be.true;
  });

  it("should display a warning message", () => {
    showMessage.resetHistory();
    const localDetails = new NotifyMessageDetails(OutputMessagePriority.Warning, "Brief", "Detailed", OutputMessageType.Pointer);
    notifications.outputMessage(localDetails);
    expect(showMessage.called).to.be.true;
  });

  it("should display an error message", () => {
    showMessage.resetHistory();
    const localDetails = new NotifyMessageDetails(OutputMessagePriority.Error, "Brief", "Detailed", OutputMessageType.Pointer);
    notifications.outputMessage(localDetails);
    expect(showMessage.called).to.be.true;
  });

  it("should offset the message", () => {
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

  it("should unmount correctly", () => {
    const sut = enzyme.mount(<PointerMessage />);
    sut.unmount();
  });

});
