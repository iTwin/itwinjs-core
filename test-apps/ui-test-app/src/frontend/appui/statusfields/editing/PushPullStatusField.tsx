/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./PushPullField.scss";
import * as React from "react";
import { BeEvent } from "@itwin/core-bentley";
import { ChangeSetPostPushEvent, ChangeSetQuery, IModelHubFrontend } from "@bentley/imodelhub-client";
import {
  BriefcaseConnection, IModelApp, NotifyMessageDetails, OutputMessageAlert, OutputMessagePriority, OutputMessageType,
} from "@itwin/core-frontend";
import { Icon } from "@itwin/core-react";
import { StatusFieldProps, UiFramework } from "@itwin/appui-react";
import { FooterIndicator } from "@itwin/appui-layout-react";
import { ProgressRadial } from "@itwin/itwinui-react";
import { ErrorHandling } from "../../../api/ErrorHandling";

function translate(prompt: string) {
  return IModelApp.localization.getLocalizedString(`SampleApp:statusFields.${prompt}`);
}

interface PushPullState {
  timeOfLastSaveEvent: number;    // work around out-of-order events
  mustPush: boolean;
  parentChangesetId: string;
  changesOnServer: string[];
  isSynchronizing: boolean;
}

class SyncManager {
  public static state: PushPullState = { timeOfLastSaveEvent: 0, mustPush: false, parentChangesetId: "", changesOnServer: [], isSynchronizing: false };
  public static onStateChange = new BeEvent();
  public static changesetListenerInitialized = false;
  public static localChangesListenerInitialized = false;

  public static get briefcaseConnection(): BriefcaseConnection | undefined {
    const iModelConnection = UiFramework.getIModelConnection();
    if (iModelConnection && iModelConnection.isBriefcaseConnection())
      return iModelConnection;
    return undefined;
  }

  public static async initializeChangesetListener() {
    if (this.changesetListenerInitialized)
      return;
    this.changesetListenerInitialized = true;

    if (this.briefcaseConnection) {
      const iModelId = this.briefcaseConnection.iModelId;
      try {
        const accessToken = await IModelApp.getAccessToken();
        // Bootstrap the process by finding out if there are newer changesets on the server already.
        this.state.parentChangesetId = this.briefcaseConnection.changeset.id;

        if (!!this.state.parentChangesetId) {  // avoid error if imodel has no changesets.
          const hubAccess = new IModelHubFrontend();
          const allOnServer = await hubAccess.hubClient.changeSets.get(accessToken, iModelId, new ChangeSetQuery().fromId(this.state.parentChangesetId));
          this.state.changesOnServer = allOnServer.map((changeset) => changeset.id!);

          this.onStateChange.raiseEvent();

          // Once the initial state of the briefcase is known, register for events announcing new changesets
          const changeSetSubscription = await hubAccess.hubClient.events.subscriptions.create(accessToken, iModelId, ["ChangeSetPostPushEvent"]); // eslint-disable-line deprecation/deprecation

          hubAccess.hubClient.events.createListener(async () => accessToken, changeSetSubscription.wsgId, iModelId, async (receivedEvent: ChangeSetPostPushEvent) => {
            if (receivedEvent.changeSetId !== this.state.parentChangesetId) {
              this.state.changesOnServer.push(receivedEvent.changeSetId);
              this.onStateChange.raiseEvent();
            }
          });
        }
      } catch (err: any) {
        ErrorHandling.onUnexpectedError(err);
      }
    }
  }

  public static async initializeLocalChangesListener() {
    if (this.localChangesListenerInitialized || undefined === this.briefcaseConnection)
      return;

    this.localChangesListenerInitialized = true;
    try {
      // Bootstrap the process by finding out if the briefcase has local txns already.
      this.state.mustPush = await this.briefcaseConnection.hasPendingTxns();
    } catch (err: any) {
      ErrorHandling.onUnexpectedError(err);
    }

    this.onStateChange.raiseEvent();

    // Once the initial state of the briefcase is known, register for events announcing new txns and pushes that clear local txns.
    const txns = this.briefcaseConnection.txns;
    if (txns) {
      txns.onCommitted.addListener((hasPendingTxns, time) => {
        if (time > this.state.timeOfLastSaveEvent) { // work around out-of-order events
          this.state.timeOfLastSaveEvent = time;
          this.state.mustPush = hasPendingTxns;
          this.onStateChange.raiseEvent();
        }
      });

      txns.onChangesPushed.addListener((parentChangeset) => {
        // In case I got the changeSetSubscription event first, remove the changeset that I pushed from the list of server changes waiting to be merged.
        const allChangesOnServer = this.state.changesOnServer.filter((cs) => cs !== parentChangeset.id);
        this.state.mustPush = false;
        this.state.changesOnServer = allChangesOnServer;
        this.state.parentChangesetId = parentChangeset.id;
        this.onStateChange.raiseEvent();
      });

      txns.onChangesPulled.addListener((parentChangeset) => {
        this.updateParentChangesetId(parentChangeset.id);
        this.onStateChange.raiseEvent();
      });
    }
  }

  private static updateParentChangesetId(parentChangeSetId: string) {
    this.state.parentChangesetId = parentChangeSetId;
    const lastPulledIdx = this.state.changesOnServer.findIndex((csId) => csId === parentChangeSetId);
    if (lastPulledIdx !== -1)
      this.state.changesOnServer.splice(0, lastPulledIdx + 1); // (changeSetSubscription might have added to changesOnServer after I pulled but before this event was fired)
    else
      this.state.changesOnServer = [];
  }

  public static async syncChanges(doPush: boolean) {
    if (this.state.isSynchronizing || undefined === this.briefcaseConnection)
      return;

    const failmsg = translate(doPush ? "pullMergePushFailed" : "pullMergeFailed");

    this.state.isSynchronizing = true;
    this.onStateChange.raiseEvent();

    try {
      await this.briefcaseConnection.pushChanges("");
      const parentChangesetId = this.briefcaseConnection.changeset.id;
      this.updateParentChangesetId(parentChangesetId);
    } catch (err: any) {
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
  }

  private syncState = () => {
    this.setState(SyncManager.state);
  };

  public override componentDidMount(): void {
    if (SyncManager.briefcaseConnection) {
      SyncManager.onStateChange.addListener(this.syncState);
      SyncManager.initializeLocalChangesListener().catch((err) => ErrorHandling.onUnexpectedError(err));
      SyncManager.initializeChangesetListener().catch((err) => ErrorHandling.onUnexpectedError(err));
    }
  }

  public override componentWillUnmount() {
    SyncManager.onStateChange.removeListener(this.syncState);
  }

  private get mustPush(): boolean { return this.state.mustPush; }
  private get mustPull(): boolean { return this.state.changesOnServer.length !== 0; }

  public override render() {
    // only display status complete status field if IModelConnection is a BriefcaseConnection
    if (undefined === SyncManager.briefcaseConnection)
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
              <ProgressRadial size="x-small" indeterminate />
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
