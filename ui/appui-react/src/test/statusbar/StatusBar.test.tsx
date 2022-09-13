/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { act, fireEvent, render, screen, waitForElementToBeRemoved } from "@testing-library/react";
import {
  ActivityMessageDetails, ActivityMessageEndReason, NoRenderApp, NotifyMessageDetails, OutputMessagePriority, OutputMessageType,
} from "@itwin/core-frontend";
import { MessageSeverity, WidgetState } from "@itwin/appui-abstract";
import {
  AppNotificationManager, ConfigurableCreateInfo, ConfigurableUiControlType, MessageCenterField, StatusBar, StatusBarCenterSection,
  StatusBarLeftSection, StatusBarRightSection, StatusBarSpaceBetween, StatusBarWidgetControl, WidgetDef,
} from "../../appui-react";
import TestUtils from "../TestUtils";
import { MessageManager } from "../../appui-react/messages/MessageManager";
import { StatusMessagesContainer } from "../../appui-react/messages/StatusMessagesContainer";

describe("StatusBar", () => {

  class AppStatusBarWidgetControl extends StatusBarWidgetControl {
    constructor(info: ConfigurableCreateInfo, options: any) {
      super(info, options);
    }

    public getReactNode(): React.ReactNode {
      return (
        <>
          <MessageCenterField />
        </>
      );
    }
  }

  let widgetControl: StatusBarWidgetControl | undefined;
  let notifications: AppNotificationManager;

  before(async () => {
    await TestUtils.initializeUiFramework();

    const statusBarWidgetDef = new WidgetDef({
      classId: AppStatusBarWidgetControl,
      defaultState: WidgetState.Open,
      isFreeform: false,
      isStatusBar: true,
    });
    widgetControl = statusBarWidgetDef.getWidgetControl(ConfigurableUiControlType.StatusBarWidget) as StatusBarWidgetControl;

    notifications = new AppNotificationManager();
    await NoRenderApp.startup();
    MessageManager.clearMessages();
  });

  after(async () => {
    TestUtils.terminateUiFramework();
  });

  [true, false, undefined].map((isInFooterMode) => {
    it(`StatusBar should handle isInFooterMode=${isInFooterMode}${isInFooterMode !== undefined ? " (deprecated)" : ""}`, async () => {
      const spy = sinon.spy(widgetControl as StatusBarWidgetControl, "getReactNode");
      render(<StatusBar widgetControl={widgetControl} isInFooterMode={isInFooterMode} />);

      expect(spy.alwaysCalledWith(sinon.match({isInFooterMode: isInFooterMode ?? true}))).to.be.true;
      spy.restore();
    });
  });

  it("StatusBar should render a Toast message", async () => {
    render(<StatusBar widgetControl={widgetControl} />);

    const details = new NotifyMessageDetails(OutputMessagePriority.None, "A brief message.", "A detailed message.");
    act(() => {
      notifications.outputMessage(details);
    });
    expect(await screen.findByText("A brief message.")).to.be.not.null;

    act(() => {
      MessageManager.closeAllMessages();
    });
    await waitForElementToBeRemoved(screen.queryByText("A brief message."));
  });

  it("StatusBar should render a Sticky message", async () => {
    render(<StatusBar widgetControl={widgetControl} />);

    const details = new NotifyMessageDetails(OutputMessagePriority.Info, "A brief message.", "A detailed message.", OutputMessageType.Sticky);
    act(() => {
      notifications.outputMessage(details);
    });
    expect(await screen.findByText("A brief message.")).to.be.not.null;

    act(() => {
      MessageManager.closeAllMessages();
    });
    await waitForElementToBeRemoved(screen.queryByText("A brief message."));
  });

  it("Sticky message should close on button click", async () => {
    render(<StatusBar widgetControl={widgetControl} />);

    const details = new NotifyMessageDetails(OutputMessagePriority.Error, "A brief message.", "A detailed message.", OutputMessageType.Sticky);
    act(() => {
      notifications.outputMessage(details);
    });
    expect(await screen.findByText("A brief message.")).to.be.not.null;

    const closeButton = screen.getByRole("button", {name: "Close"});
    fireEvent.click(closeButton);
    await waitForElementToBeRemoved(screen.queryByText("A brief message."));
    act(() => {
      MessageManager.clearMessages();
    });
  });

  it("StatusBar should render an Activity message", async () => {
    render(<StatusBar widgetControl={widgetControl} />);

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
  });

  it("Activity message should be canceled", async () => {
    render(<StatusBar widgetControl={widgetControl} />);

    const details = new ActivityMessageDetails(true, true, true);
    notifications.setupActivityMessage(details);
    act(() => {
      notifications.outputActivityMessage("Message text", 50);
    });
    expect(await screen.findByText("Message text")).to.be.not.null;

    const cancelLink = await screen.findByText("dialog.cancel");
    fireEvent.click(cancelLink);

    await waitForElementToBeRemoved(screen.queryByText("Message text"));
  });

  it("Activity message should be dismissed", async () => {
    render(<StatusBar widgetControl={widgetControl} />);

    const details = new ActivityMessageDetails(true, true, true);
    notifications.setupActivityMessage(details);
    notifications.setupActivityMessage(details);
    act(() => {
      notifications.outputActivityMessage("Message text", 50);
    });
    expect(await screen.findByText("Message text")).to.be.not.null;

    const closeButton = screen.getByRole("button", {name: "Close"});
    fireEvent.click(closeButton);
    await waitForElementToBeRemoved(screen.queryByText("Message text"));
  });

  it("StatusBar should render Toast, Sticky & Activity messages", async () => {
    render(<StatusBar widgetControl={widgetControl} />);

    const details1 = new NotifyMessageDetails(OutputMessagePriority.Warning, "A brief message.", "A detailed message.");
    const details2 = new NotifyMessageDetails(OutputMessagePriority.None, "A brief sticky message.", "A detailed message.", OutputMessageType.Sticky);
    const details3 = new ActivityMessageDetails(true, true, true);
    notifications.setupActivityMessage(details3);
    act(() => {
      notifications.outputMessage(details1);
      notifications.outputMessage(details2);
      notifications.outputActivityMessage("Message text", 50);
    });
    expect(await screen.findByText("A brief message.")).to.be.not.null;
    expect(await screen.findByText("A brief sticky message.")).to.be.not.null;
    expect(await screen.findByText("Message text")).to.be.not.null;
    expect(document.querySelector(".nz-content")?.textContent).to.eq("2");
    act(() => {
      notifications.endActivityMessage(ActivityMessageEndReason.Completed);
    });
    act(() => {
      MessageManager.closeAllMessages();
    });
    await waitForElementToBeRemoved(screen.queryByText("A brief sticky message."));
  });

  it("StatusBar should render maximum of 3 Sticky messages", async () => {
    MessageManager.maxDisplayedStickyMessages = 3;

    render(<StatusBar widgetControl={widgetControl} />);

    const details1 = new NotifyMessageDetails(OutputMessagePriority.None, "A brief message 1.", undefined, OutputMessageType.Sticky);
    act(() => {
      notifications.outputMessage(details1);
    });
    expect(await screen.findByText("A brief message 1.")).to.be.not.null;
    const details2 = new NotifyMessageDetails(OutputMessagePriority.None, "A brief message 2.", undefined, OutputMessageType.Sticky);
    act(() => {
      notifications.outputMessage(details2);
    });
    expect(await screen.findByText("A brief message 2.")).to.be.not.null;
    const details3 = new NotifyMessageDetails(OutputMessagePriority.None, "A brief message 3.", undefined, OutputMessageType.Sticky);
    act(() => {
      notifications.outputMessage(details3);
    });
    expect(await screen.findByText("A brief message 3.")).to.be.not.null;

    const details4 = new NotifyMessageDetails(OutputMessagePriority.None, "A brief message 4.", undefined, OutputMessageType.Sticky);
    act(() => {
      notifications.outputMessage(details4);
    });
    await waitForElementToBeRemoved(screen.queryByText("A brief message 1."));
    expect(await screen.findByText("A brief message 4.")).to.be.not.null;

    act(() => {
      MessageManager.closeAllMessages();
    });
    await waitForElementToBeRemoved(screen.queryByText("A brief message 4."));
  });

  it("StatusBar should not render a Pointer message", () => {
    render(<StatusBar widgetControl={widgetControl} />);

    const details = new NotifyMessageDetails(OutputMessagePriority.Info, "A brief message.", "A detailed message.", OutputMessageType.Pointer);
    act(() => {
      notifications.outputMessage(details);
    });

    expect(screen.queryByText("A brief message.")).to.be.null;
  });

  it("StatusBar should clear messages", async () => {
    render(<StatusBar widgetControl={widgetControl} />);

    const details = new NotifyMessageDetails(OutputMessagePriority.Info, "A brief toast message.", "A detailed message.", OutputMessageType.Sticky);
    act(() => {
      notifications.outputMessage(details);
    });
    expect(await screen.findByText("A brief toast message.")).to.be.not.null;

    act(() => {
      MessageManager.clearMessages();
    });
    await waitForElementToBeRemoved(screen.queryByText("A brief toast message."));
  });

  it("StatusMessageRenderer should render empty correctly", () => {
    // eslint-disable-next-line deprecation/deprecation
    const { container } = render(<StatusMessagesContainer
      messages={[]}
      activityMessageInfo={undefined}
      isActivityMessageVisible={false}
      toastTarget={null}
      closeMessage={() => { }}
      cancelActivityMessage={() => { }}
      dismissActivityMessage={() => { }}
    />);
    expect(container.querySelectorAll("div").length).to.eq(0);
  });

  it("StatusBarSpaceBetween should render correctly", () => {
    const { container } = render(<StatusBarSpaceBetween>Hello</StatusBarSpaceBetween>);
    expect(container.querySelectorAll("div.uifw-statusbar-space-between").length).to.eq(1);
  });

  it("StatusBarLeftSection should render correctly", () => {
    const { container } = render(<StatusBarLeftSection>Hello</StatusBarLeftSection>);
    expect(container.querySelectorAll("div.uifw-statusbar-left").length).to.eq(1);
  });

  it("StatusBarCenterSection should render correctly", () => {
    const { container } = render(<StatusBarCenterSection>Hello</StatusBarCenterSection>);
    expect(container.querySelectorAll("div.uifw-statusbar-center").length).to.eq(1);
  });

  it("StatusBarRightSection should render correctly", () => {
    const { container } = render(<StatusBarRightSection>Hello</StatusBarRightSection>);
    expect(container.querySelectorAll("div.uifw-statusbar-right").length).to.eq(1);
  });

  describe("<StatusMessagesContainer />", () => {
    const sandbox = sinon.createSandbox();
    const messages = [
      { id: "one", messageDetails: new NotifyMessageDetails(OutputMessagePriority.Info, "message1", "Detailed message1", OutputMessageType.Toast), severity: MessageSeverity.Information },
      { id: "two", messageDetails: new NotifyMessageDetails(OutputMessagePriority.Info, "message2", "Detailed message3", OutputMessageType.Toast), severity: MessageSeverity.Information },
      { id: "three", messageDetails: new NotifyMessageDetails(OutputMessagePriority.Info, "message3", "Detailed message3", OutputMessageType.Sticky), severity: MessageSeverity.Question },
      { id: "four", messageDetails: new NotifyMessageDetails(OutputMessagePriority.Info, "message4", "Detailed message4", OutputMessageType.Pointer), severity: MessageSeverity.Question },
    ];

    afterEach(() => {
      sandbox.restore();
    });

    it("will render with message container height < window.innerHeight, not scrollable", () => {
      sandbox.stub(window, "innerHeight").get(() => 1000);

      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("uifw-statusbar-messages-container")) {
          return DOMRect.fromRect({ width: 200, height: 200 });
        }
        return new DOMRect();
      });

      // eslint-disable-next-line deprecation/deprecation
      const renderedComponent = render(<StatusMessagesContainer
        messages={messages}
        activityMessageInfo={undefined}
        isActivityMessageVisible={false}
        toastTarget={null}
        closeMessage={() => { }}
        cancelActivityMessage={() => { }}
        dismissActivityMessage={() => { }}
      />);
      expect(renderedComponent.container.querySelectorAll("div.uifw-statusbar-messages-container.uifw-scrollable").length).to.eq(0);
      expect(renderedComponent.container.querySelectorAll("li").length).to.eq(3);
      renderedComponent.unmount();
    });

    it("will render with message container height > window.innerHeight, scrollable", () => {
      sandbox.stub(window, "innerHeight").get(() => 200);
      // eslint-disable-next-line prefer-arrow/prefer-arrow-functions
      sandbox.stub(Element.prototype, "getBoundingClientRect").callsFake(function (this: HTMLElement) {
        if (this.classList.contains("uifw-statusbar-messages-container")) {
          return DOMRect.fromRect({ width: 200, height: 300 });
        }
        return new DOMRect();
      });

      // eslint-disable-next-line deprecation/deprecation
      const renderedComponent = render(<StatusMessagesContainer
        messages={messages}
        activityMessageInfo={undefined}
        isActivityMessageVisible={false}
        toastTarget={null}
        closeMessage={() => { }}
        cancelActivityMessage={() => { }}
        dismissActivityMessage={() => { }}
      />);
      expect(renderedComponent.container.querySelectorAll("div.uifw-statusbar-messages-container.uifw-scrollable").length).to.eq(1);
      expect(renderedComponent.container.querySelectorAll("li").length).to.eq(3);
      renderedComponent.unmount();
    });

    it("will render activity message and cancel it", async () => {
      const spy = sinon.spy();
      const details = new ActivityMessageDetails(true, true, true);
      // eslint-disable-next-line deprecation/deprecation
      render(<StatusMessagesContainer
        messages={[]}
        activityMessageInfo={{message: "My activity message", percentage: 0, details }}
        isActivityMessageVisible
        toastTarget={null}
        closeMessage={() => { }}
        cancelActivityMessage={spy}
        dismissActivityMessage={() => { }}
      />);
      const cancelLink = await screen.findByText("dialog.cancel");
      fireEvent.click(cancelLink);
      spy.calledOnce.should.true;
    });

    it("will render activity message and dismiss it", async () => {
      const spy = sinon.spy();
      const details = new ActivityMessageDetails(true, true, false);
      // eslint-disable-next-line deprecation/deprecation
      render(<StatusMessagesContainer
        messages={[]}
        activityMessageInfo={{message: "My activity message", percentage: 0, details }}
        isActivityMessageVisible
        toastTarget={null}
        closeMessage={() => { }}
        cancelActivityMessage={() => { }}
        dismissActivityMessage={spy}
      />);
      const closeButton = screen.getByRole("button");
      fireEvent.click(closeButton);
      spy.calledOnce.should.true;
    });

  });
});
