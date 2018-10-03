/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as enzyme from "enzyme";
import * as sinon from "sinon";
import TestUtils from "../TestUtils";
import PointerMessage from "../../src/messages/Pointer";
import { AppNotificationManager } from "../../src/configurableui/AppNotificationManager";
import { NotifyMessageDetails, OutputMessagePriority, OutputMessageType, RelativePosition } from "@bentley/imodeljs-frontend";

describe("PointerMessage", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
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
    const showMessage = sinon.spy(PointerMessage, "showMessage");
    notifications.outputMessage(details);
    expect(showMessage.called).to.be.true;
  });

  it("should hide the message", () => {
    const hideMessage = sinon.spy(PointerMessage, "hideMessage");
    notifications.closePointerMessage();
    expect(hideMessage.called).to.be.true;
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
