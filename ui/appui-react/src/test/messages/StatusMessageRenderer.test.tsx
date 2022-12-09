/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import * as React from "react";
import { ActivityMessageDetails, ActivityMessageEndReason, NoRenderApp, NotifyMessageDetails, OutputMessagePriority, OutputMessageType } from "@itwin/core-frontend";
import { AppNotificationManager, MessageManager, StatusMessageRenderer } from "../../appui-react";
import { TestUtils } from "../TestUtils";
import { act, fireEvent, render, screen, waitForElementToBeRemoved } from "@testing-library/react";
import { EmptyLocalization } from "@itwin/core-common";

describe("StatusMessageRenderer", () => {

  let notifications: AppNotificationManager;

  before(async () => {
    await TestUtils.initializeUiFramework();

    notifications = new AppNotificationManager();
    await NoRenderApp.startup({ localization: new EmptyLocalization() });
    MessageManager.clearMessages();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("Renderer should render a Toast message", async () => {
    // eslint-disable-next-line deprecation/deprecation
    render(<StatusMessageRenderer />);

    const details = new NotifyMessageDetails(OutputMessagePriority.Info, "Message", "Details", OutputMessageType.Toast);
    act(() => {
      notifications.outputMessage(details);
    });

    expect(await screen.findByText("Message")).to.be.not.null;

    act(() => {
      MessageManager.clearMessages();
    });
    await waitForElementToBeRemoved(screen.queryByText("Message"));
  });

  it("Renderer should render a Sticky  message", async () => {
    // eslint-disable-next-line deprecation/deprecation
    render(<StatusMessageRenderer />);

    const details = new NotifyMessageDetails(OutputMessagePriority.Info, "Message", "Details", OutputMessageType.Sticky);
    act(() => {
      notifications.outputMessage(details);
    });

    expect(await screen.findByText("Message")).to.be.not.null;

    act(() => {
      MessageManager.clearMessages();
    });
    await waitForElementToBeRemoved(screen.queryByText("Message"));
  });

  it("Sticky message should close on button click", async () => {
    const spy = sinon.spy();
    // eslint-disable-next-line deprecation/deprecation
    render(<StatusMessageRenderer closeMessage={spy} />);

    const details = new NotifyMessageDetails(OutputMessagePriority.Error, "A brief message.", "A detailed message.", OutputMessageType.Sticky);
    act(() => {
      notifications.outputMessage(details);
    });
    expect(await screen.findByText("A brief message.")).to.be.not.null;

    const closeButton = screen.getByRole("button");
    fireEvent.click(closeButton);
    await waitForElementToBeRemoved(screen.queryByText("A brief message."));
    spy.calledOnce.should.true;
    act(() => {
      MessageManager.clearMessages();
    });
  });

  it("Renderer should render an Activity message", async () => {
    // eslint-disable-next-line deprecation/deprecation
    render(<StatusMessageRenderer cancelActivityMessage={() => { }} dismissActivityMessage={() => { }} />);

    const details = new ActivityMessageDetails(true, true, false);
    notifications.setupActivityMessage(details);
    act(() => {
      notifications.outputActivityMessage("Message text", 50);
    });
    expect(await screen.findByText("Message text")).to.be.not.null;

    act(() => {
      notifications.endActivityMessage(ActivityMessageEndReason.Completed);
    });
    await waitForElementToBeRemoved(screen.queryByText("Message text"));
    expect(screen.queryByText("Message text")).to.be.null;
  });

  it("Activity message should be canceled", async () => {
    const spy = sinon.spy();
    // eslint-disable-next-line deprecation/deprecation
    render(<StatusMessageRenderer cancelActivityMessage={spy} dismissActivityMessage={() => { }} />);

    const details = new ActivityMessageDetails(true, true, true);
    notifications.setupActivityMessage(details);
    act(() => {
      notifications.outputActivityMessage("Message text", 50);
    });
    expect(await screen.findByText("Message text")).to.be.not.null;

    const cancelLink = await screen.findByText("dialog.cancel");
    fireEvent.click(cancelLink);

    await waitForElementToBeRemoved(screen.queryByText("Message text"));
    expect(screen.queryByText("Message text")).to.be.null;
    spy.calledOnce.should.true;
  });

  it("Activity message should be dismissed & restored", async () => {
    const spy = sinon.spy();
    // eslint-disable-next-line deprecation/deprecation
    render(<StatusMessageRenderer cancelActivityMessage={() => { }} dismissActivityMessage={spy} />);

    const details = new ActivityMessageDetails(true, true, true);
    notifications.setupActivityMessage(details);
    act(() => {
      notifications.outputActivityMessage("Message text", 50);
    });
    expect(await screen.findByText("Message text")).to.be.not.null;

    const closeButton = screen.getByRole("button");
    fireEvent.click(closeButton);
    await waitForElementToBeRemoved(screen.queryByText("Message text"));
    expect(screen.queryByText("Message text")).to.be.null;
    spy.calledOnce.should.true;

    act(() => {
      notifications.outputActivityMessage("Message text", 60);
    });
    expect(screen.queryByText("Message text")).to.be.null;

    act(() => {
      MessageManager.setupActivityMessageValues("Test message text", 75, true);   // restore
    });
    expect(screen.queryByText("Message text")).to.be.null;
    expect(await screen.findByText("75 activityCenter.percentComplete")).to.be.not.null;

    act(() => {
      notifications.endActivityMessage(ActivityMessageEndReason.Completed);
    });
    await waitForElementToBeRemoved(screen.queryByText("Test message text"));
    expect(screen.queryByText("Test message text")).to.be.null;
  });

  it("Renderer should clear messages", async () => {
    // eslint-disable-next-line deprecation/deprecation
    render(<StatusMessageRenderer />);

    const details = new NotifyMessageDetails(OutputMessagePriority.Info, "A brief message.", "A detailed message.", OutputMessageType.Sticky);
    act(() => {
      notifications.outputMessage(details);
    });
    expect(await screen.findByText("A brief message.")).to.be.not.null;

    act(() => {
      MessageManager.clearMessages();
    });
    await waitForElementToBeRemoved(screen.queryByText("A brief message."));
    expect(screen.queryByText("A brief message.")).to.be.null;
  });
});
