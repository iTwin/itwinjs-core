/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority, OutputMessageType, OutputMessageAlert, EventSourceManager, AuthorizedFrontendRequestContext } from "@bentley/imodeljs-frontend";
import { Notifications, emptyNotification, LatestNotifications } from "../api/NotificationManager";
// tslint:disable-next-line:no-direct-imports
import { IModelWriteRpcInterface } from "@bentley/imodeljs-common";
import { AppState } from "../api/AppState";
import { ErrorHandling } from "../api/ErrorHandling";
import { ChangeSetPostPushEvent, ChangeSetQuery } from "@bentley/imodeljs-clients";
import { SimpleEditorApp } from "../api/SimpleEditorApp";
import { Spinner, SpinnerSize } from "@bentley/ui-core";

function statusBarString(key: string): string {
  return IModelApp.i18n.translate(SimpleEditorApp.namespace.name + ":statusBar." + key);
}

interface PushPullState {
  timeOfLastSaveEvent: number;    // work around out-of-order events
  mustPush: boolean;
  parentChangesetId: string;
  changesOnServer: string[];
  isSynchronizing: boolean;
}

class SyncComponent extends React.Component<{}, PushPullState> {
  constructor(props?: any, context?: any) {
    super(props, context);
    this.state = { timeOfLastSaveEvent: 0, mustPush: false, parentChangesetId: "", changesOnServer: [], isSynchronizing: false };
    this.initializeLocalChangesListener();
    this.initializeChangesetListener().catch((err) => ErrorHandling.onUnexpectedError(err));
  }

  private async initializeChangesetListener() {
    const iModelId = AppState.iModelConnection.iModelToken.iModelId!;
    const requestContext = await AuthorizedFrontendRequestContext.create();

    // Bootstrap the process by finding out if there are newer changesets on the server already.
    AppState.iModelConnection.editing.getParentChangeset()
      .then(async (parentChangesetId) => {
        this.setState((prev) => ({ ...prev, parentChangesetId }));

        IModelApp.iModelClient.changeSets.get(requestContext, iModelId, new ChangeSetQuery().fromId(this.state.parentChangesetId))
          .then(async (changesetsOnServer) => {
            const changesOnServer = changesetsOnServer.map((changeset) => changeset.id!);
            this.setState((prev) => ({ ...prev, changesOnServer }));

            // Once the initial state of the briefcase is known, register for events announcing new changesets
            const changeSetSubscription = await IModelApp.iModelClient.events.subscriptions.create(requestContext, iModelId, ["ChangeSetPostPushEvent"]);
            IModelApp.iModelClient.events.createListener(requestContext, async () => requestContext.accessToken, changeSetSubscription.wsgId, iModelId, async (receivedEvent: ChangeSetPostPushEvent) => {
              if (receivedEvent.changeSetId !== this.state.parentChangesetId) {
                const allChangesOnServer = Array.from(this.state.changesOnServer);
                allChangesOnServer.push(receivedEvent.changeSetId!);
                this.setState((prev) => ({ ...prev, changesOnServer: allChangesOnServer }));
              }
            });
          });
      });
  }

  private initializeLocalChangesListener() {
    // Bootstrap the process by finding out if the briefcase has local txns already.
    AppState.iModelConnection.editing.hasPendingTxns()
      .then((hasPendingTxns) => {
        this.setState((prev) => ({ ...prev, mustPush: hasPendingTxns }));

        // Once the initial state of the briefcase is known, register for events announcing new txns and pushes that clear local txns.
        EventSourceManager.get(AppState.iModelConnection.iModelToken.key!).on(IModelWriteRpcInterface.name, "onSavedChanges", (data: any) => {
          if (data.time > this.state.timeOfLastSaveEvent) // work around out-of-order events
            this.setState((prev) => ({ ...prev, timeOfLastSaveEvent: data.time, mustPush: data.hasPendingTxns }));
        });
        EventSourceManager.get(AppState.iModelConnection.iModelToken.key!).on(IModelWriteRpcInterface.name, "onPushedChanges", (data: any) => {
          // In case I got the changeSetSubscription event first, remove the changeset that I pushed from the list of server changes waiting to be merged.
          const allChangesOnServer = this.state.changesOnServer.filter((cs) => cs !== data.parentChangeSetId);
          this.setState((prev) => ({ ...prev, mustPush: false, changesOnServer: allChangesOnServer, parentChangesetId: data.parentChangeSetId }));
        });
      })
      .catch((err: Error) => ErrorHandling.onUnexpectedError(err));
  }

  private getSyncSpinner(itemkey: string) {
    return (
      <div key={itemkey} id="status-bar-button-style">
        <Spinner size={SpinnerSize.Small} />
      </div>
    );
  }

  private getPushButton() {
    const mustPush = this.mustPush && !this.state.isSynchronizing;
    const icon = mustPush ? "icon icon-upload" : "icon icon-blank";
    const titleTxt = statusBarString(mustPush ? "pushButtonTitle" : "pushButtonDisabledTitle");
    return (
      <div key="local-changes" id="status-bar-button-style">
        <a href="#" title={titleTxt} onClick={() => this.syncChanges(true)}><span className={icon}></span></a>
      </div>
    );
  }

  private getPullButton() {
    if (this.state.isSynchronizing) {
      return this.getSyncSpinner("server-changes");
    }

    const mustPull = this.mustPull;
    const icon = mustPull ? "icon icon-download" : "icon icon-checkmark";
    const changeSets = (this.state.changesOnServer.length !== 0) ? this.state.changesOnServer.join(", ") : "";
    const titleTxt = statusBarString(mustPull ? "pullButtonTitle" : "pullButtonDisabledTitle") + changeSets;
    return (
      <div key="server-changes" id="status-bar-button-style">
        <a href="#" title={titleTxt} onClick={() => this.syncChanges(false)}><span className={icon}></span></a>
      </div>
    );
  }

  private get mustPull(): boolean { return this.state.changesOnServer.length !== 0; }
  private get mustPush(): boolean { return this.state.mustPush; }

  private async syncChanges(doPush: boolean) {

    if (this.state.isSynchronizing)
      return;

    const failmsg = statusBarString(doPush ? "pullMergePushFailed" : "pullMergeFailed");

    this.setState((prev) => ({ ...prev, isSynchronizing: true }));
    AppState.iModelConnection.editing.concurrencyControl.pullMergePush("", doPush)
      .then(() => {
        this.setState((prev) => ({ ...prev, isSynchronizing: false }));
      })
      .catch((err: Error) => {
        this.setState((prev) => ({ ...prev, isSynchronizing: false }));
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, failmsg, err.message, OutputMessageType.Alert, OutputMessageAlert.Dialog));
      });
  }

  public render() {
    if (!AppState.isOpen)
      return <div />;
    const push = this.getPushButton();
    const pull = this.getPullButton();
    return [push, pull];
  }
}

interface StatusBarState {
  tool: string;
  notifications: LatestNotifications;
}

export class StatusBar extends React.PureComponent<{}, StatusBarState> {
  constructor(props?: any, context?: any) {
    super(props, context);
    this.state = { tool: "", notifications: { prompt: "", message: emptyNotification } };
    IModelApp.toolAdmin.activeToolChanged.addListener((tool) => this.setState((prev) => ({ ...prev, tool: tool.toolId })));
    (IModelApp.notifications as Notifications).onChange.addListener((notifications) => this.setState((prev) => ({ ...prev, notifications })));
  }

  public render() {
    return (<div className="status-bar">
      <div id="status-bar-tool-and-prompt">
        <span >{this.state.tool}> {this.state.notifications.prompt}</span>
      </div>
      <div id="status-bar-message">
        <span title={this.state.notifications.message.detailedMessage as string}>{this.state.notifications.message.briefMessage}</span>
      </div>
      <div id="status-bar-button-group">
        <SyncComponent />
      </div>
    </div >);
  }
}
