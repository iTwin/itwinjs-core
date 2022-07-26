/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import * as React from "react";
import {
  ActivityMessageDetails,
  ActivityMessageEndReason,
  NoRenderApp,
} from "@itwin/core-frontend";
import {
  ActivityMessagePopup,
  AppNotificationManager,
  MessageManager,
} from "../../appui-react";
import { TestUtils } from "../TestUtils";
import { act, fireEvent, render, screen, waitForElementToBeRemoved } from "@testing-library/react";

describe("ActivityMessagePopup", () => {

  let notifications: AppNotificationManager;

  before(async () => {
    await TestUtils.initializeUiFramework();

    notifications = new AppNotificationManager();
    await NoRenderApp.startup();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("Popup should render an Activity message", async () => {
    render(
      <ActivityMessagePopup
        cancelActivityMessage={() => {}}
        dismissActivityMessage={() => {}}
      />
    );
    const details = new ActivityMessageDetails(true, true, false);
    notifications.setupActivityMessage(details);
    act(() => {
      notifications.outputActivityMessage("Message text", 0);
    });
    expect(await screen.findByText("Message text")).to.be.not.null;

    act(() => {
      notifications.endActivityMessage(ActivityMessageEndReason.Completed);
    });
    await waitForElementToBeRemoved(screen.queryByText("Message text"));
    expect(screen.queryByText("Message text")).to.be.null;
  });

  it("Popup should render an Activity message without details", async () => {
    render(
      <ActivityMessagePopup
        cancelActivityMessage={() => {}}
        dismissActivityMessage={() => {}}
      />
    );
    const details = new ActivityMessageDetails(false, false, false);
    notifications.setupActivityMessage(details);
    act(() => {
      notifications.outputActivityMessage("Activity message text", 20);
    });
    expect(await screen.findByText("Activity message text")).to.be.not.null;
    expect(screen.queryByText("20")).to.be.null;

    act(() => {
      notifications.endActivityMessage(ActivityMessageEndReason.Completed);
    });
  });

  it("Activity message should be canceled", async () => {
    const spy = sinon.spy();
    render(
      <ActivityMessagePopup
        cancelActivityMessage={spy}
        dismissActivityMessage={() => {}}
      />
    );
    const details = new ActivityMessageDetails(true, true, true);
    notifications.setupActivityMessage(details);
    act(() => {
      notifications.outputActivityMessage("Message text", 0);
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
    render(
      <ActivityMessagePopup
        cancelActivityMessage={() => {}}
        dismissActivityMessage={spy}
      />
    );
    const details = new ActivityMessageDetails(true, true, true);
    notifications.setupActivityMessage(details);
    act(() => {
      notifications.outputActivityMessage("Message text", 0);
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
});
