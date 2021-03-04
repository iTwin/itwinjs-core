/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./PushPullField.scss";
import * as React from "react";
import { BeEvent } from "@bentley/bentleyjs-core";
import { ChangeSetPostPushEvent, ChangeSetQuery } from "@bentley/imodelhub-client";
import { BriefcasePushAndPullNotifications, IpcAppChannel, RemoveFunction } from "@bentley/imodeljs-common";
import {
  AuthorizedFrontendRequestContext, BriefcaseConnection, BriefcaseNotificationHandler, IModelApp, NotifyMessageDetails, OutputMessageAlert,
  OutputMessagePriority, OutputMessageType,
} from "@bentley/imodeljs-frontend";
import { Icon, Spinner, SpinnerSize } from "@bentley/ui-core";
import { StatusFieldProps, UiFramework } from "@bentley/ui-framework";
import { FooterIndicator } from "@bentley/ui-ninezone";
import { ErrorHandling } from "../../../api/ErrorHandling";

function translate(prompt: string) {
  return IModelApp.i18n.translate(`SampleApp:statusFields.${prompt}`);
}

interface PushPullState {
  timeOfLastSaveEvent: number;    // work around out-of-order events
  mustPush: boolean;
  parentChangesetId: string;
  changesOnServer: string[];
  isSynchronizing: boolean;
}

class SyncNotifications extends BriefcaseNotificationHandler implements BriefcasePushAndPullNotifications {
  public get briefcaseChannelName() { return IpcAppChannel.PushPull; }
  public notifyPulledChanges(data: { parentChangeSetId: string }) {
    SyncManager.updateParentChangesetId(data.parentChangeSetId);
    SyncManager.onStateChange.raiseEvent();

    // TODO: Remove this when we get tile healing
    IModelApp.viewManager.refreshForModifiedModels(undefined);
  }
  public notifyPushedChanges(data: { parentChangeSetId: string }) {
    const state = SyncManager.state;

    // In case I got the changeSetSubscription event first, remove the changeset that I pushed from the list of server changes waiting to be merged.
    const allChangesOnServer = state.changesOnServer.filter((cs) => cs !== data.parentChangeSetId);
    state.mustPush = false;
    state.changesOnServer = allChangesOnServer;
    state.parentChangesetId = data.parentChangeSetId;
    SyncManager.onStateChange.raiseEvent();
  }
  public notifySavedChanges(data: { hasPendingTxns: boolean, time: number }) {
    const state = SyncManager.state;
    if (data.time > state.timeOfLastSaveEvent) { // work around out-of-order events
      state.timeOfLastSaveEvent = data.time;
      state.mustPush = data.hasPendingTxns;
      SyncManager.onStateChange.raiseEvent();
    }
  }
}

class SyncManager {
  public static state: PushPullState = { timeOfLastSaveEvent: 0, mustPush: false, parentChangesetId: "", changesOnServer: [], isSynchronizing: false };
  public static onStateChange = new BeEvent();
  public static changesetListenerInitialized = false;
  public static localChangesListenerInitialized?: RemoveFunction;

  public static get briefcaseConnection(): BriefcaseConnection {
    return UiFramework.getIModelConnection()! as BriefcaseConnection;
  }

  public static async initializeChangesetListener() {
    if (this.changesetListenerInitialized)
      return;
    this.changesetListenerInitialized = true;

    const iModelId = this.briefcaseConnection.iModelId;
    try {
      const requestContext = await AuthorizedFrontendRequestContext.create();

      // Bootstrap the process by finding out if there are newer changesets on the server already.
      this.state.parentChangesetId = this.briefcaseConnection.changeSetId!;

      if (!!this.state.parentChangesetId) {  // avoid error is imodel has no changesets.
        const allOnServer = await IModelApp.iModelClient.changeSets.get(requestContext, iModelId, new ChangeSetQuery().fromId(this.state.parentChangesetId));
        this.state.changesOnServer = allOnServer.map((changeset) => changeset.id!);

        this.onStateChange.raiseEvent();

        // Once the initial state of the briefcase is known, register for events announcing new changesets
        const changeSetSubscription = await IModelApp.iModelClient.events.subscriptions.create(requestContext, iModelId, ["ChangeSetPostPushEvent"]); // eslint-disable-line deprecation/deprecation

        IModelApp.iModelClient.events.createListener(requestContext, async () => requestContext.accessToken, changeSetSubscription.wsgId, iModelId, async (receivedEvent: ChangeSetPostPushEvent) => {
          if (receivedEvent.changeSetId !== this.state.parentChangesetId) {
            this.state.changesOnServer.push(receivedEvent.changeSetId);
            this.onStateChange.raiseEvent();
          }
        });
      }
    } catch (err) {
      ErrorHandling.onUnexpectedError(err);
    }

  }

  public static async initializeLocalChangesListener() {
    if (this.localChangesListenerInitialized)
      return;
    this.localChangesListenerInitialized = (new SyncNotifications(this.briefcaseConnection.key)).registerImpl();
    try {
      // Bootstrap the process by finding out if the briefcase has local txns already.
      this.state.mustPush = await this.briefcaseConnection.hasPendingTxns();
    } catch (err) {
      ErrorHandling.onUnexpectedError(err);
    }

    this.onStateChange.raiseEvent();
  }

  public static updateParentChangesetId(parentChangeSetId: string) {
    this.state.parentChangesetId = parentChangeSetId;
    const lastPulledIdx = this.state.changesOnServer.findIndex((csId) => csId === parentChangeSetId);
    if (lastPulledIdx !== -1)
      this.state.changesOnServer.splice(0, lastPulledIdx + 1); // (changeSetSubscription might have added to changesOnServer after I pulled but before this event was fired)
    else
      this.state.changesOnServer = [];
  }

  public static async syncChanges(doPush: boolean) {
    if (this.state.isSynchronizing)
      return;

    const failmsg = translate(doPush ? "pullMergePushFailed" : "pullMergeFailed");

    this.state.isSynchronizing = true;
    this.onStateChange.raiseEvent();

    try {
      await this.briefcaseConnection.pushChanges("");
      const parentChangesetId = this.briefcaseConnection.changeSetId!;
      this.updateParentChangesetId(parentChangesetId);
    } catch (err) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, failmsg, err.message, OutputMessageType.Alert, OutputMessageAlert.Dialog));
    } finally {
      this.state.isSynchronizing = false;
      this.onStateChange.raiseEvent();
    }
  }
}

export class PushPullStatusField extends React.Component<StatusFieldProps, PushPullState> {
  constructor(props?: any, context?: any) {
    super(props, context);

    this.state = SyncManager.state;

    SyncManager.onStateChange.addListener(() => {
      this.setState(SyncManager.state);
    });

    SyncManager.initializeLocalChangesListener().catch((err) => ErrorHandling.onUnexpectedError(err));
    SyncManager.initializeChangesetListener().catch((err) => ErrorHandling.onUnexpectedError(err));
  }

  private get mustPush(): boolean { return this.state.mustPush; }
  private get mustPull(): boolean { return this.state.changesOnServer.length !== 0; }

  public render() {
    if (UiFramework.getIModelConnection() === undefined)
      return <div />;

    if (this.state.isSynchronizing) {
      return (
        <FooterIndicator
          className={"simple-editor-app-statusFields-pushPull"}
          style={this.props.style}
          isInFooterMode={this.props.isInFooterMode}
        >
          <div id="simple-editor-app-statusFields-pushPull-buttons" title="Synchronizing...">
            <div>
              <Spinner size={SpinnerSize.Small} />
            </div>
            <span> </span>
            <div>
              <Icon iconSpec="icon icon-blank" />
            </div>
          </div>
        </FooterIndicator >
      );
    }
    const mustPush = this.mustPush && !this.state.isSynchronizing;
    const pushIcon = mustPush ? "icon icon-arrow-up" : "icon icon-blank";
    const pushTitleTxt = translate(mustPush ? "pushButtonTitle" : "pushButtonDisabledTitle");

    const mustPull = this.mustPull;
    const pullIcon = mustPull ? "icon icon-arrow-down" : "icon icon-blank";
    const pullChangeCount = (this.state.changesOnServer.length !== 0) ? `${this.state.changesOnServer.length}` : "";
    const pullTitleTxt = translate(mustPull ? "pullButtonTitle" : "pullButtonDisabledTitle");

    return (
      <FooterIndicator
        className={"simple-editor-app-statusFields-pushPull"}
        style={this.props.style}
        isInFooterMode={this.props.isInFooterMode}
      >
        <div id="simple-editor-app-statusFields-pushPull-buttons">
          <div title={pushTitleTxt} onClick={async () => SyncManager.syncChanges(true)}>
            <Icon iconSpec={pushIcon} />
          </div>
          <span> </span>
          <div title={pullTitleTxt} onClick={async () => SyncManager.syncChanges(false)}>
            {pullChangeCount}<Icon iconSpec={pullIcon} />
          </div>
        </div>
      </FooterIndicator>
    );
  }

}
