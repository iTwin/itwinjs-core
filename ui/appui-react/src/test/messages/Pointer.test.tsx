/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { NotifyMessageDetails, OutputMessagePriority, OutputMessageType } from "@itwin/core-frontend";
import { RelativePosition } from "@itwin/appui-abstract";
import { AppNotificationManager, PointerMessage } from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";

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

  it("should render correctly", () => {
    shallow(
      <PointerMessage />,
    ).should.matchSnapshot();
  });

  it("should display the message", () => {
    const showMessage = sinon.spy(PointerMessage, "showMessage");
    notifications.outputMessage(details);
    expect(showMessage.called).to.be.true;
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
    notifications.updatePointerMessage({ x: 1, y: 1 }, RelativePosition.BottomRight);
    expect(updateMessage.called).to.be.true;
  });

  it("should unmount correctly", () => {
    const sut = mount(<PointerMessage />);
    sut.unmount();
  });

});
