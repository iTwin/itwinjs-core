/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./PushPullField.scss";
import * as React from "react";
import { BeEvent, UnexpectedErrors } from "@itwin/core-bentley";
import {
  BriefcaseConnection, IModelApp, NotifyMessageDetails, OutputMessageAlert, OutputMessagePriority, OutputMessageType,
} from "@itwin/core-frontend";
import { CommonProps, Icon } from "@itwin/core-react";
import { StatusBarIndicator, UiFramework } from "@itwin/appui-react";
import { ProgressRadial } from "@itwin/itwinui-react";

function translate(prompt: string) {
  return IModelApp.localization.getLocalizedString(`SampleApp:statusFields.${prompt}`);
}

interface PushPullState {
  timeOfLastSaveEvent: number;    // work around out-of-order events
  mustPush: boolean;
  parentChangesetIndex: number;
  changesOnServer: number[];
  isSynchronizing: boolean;
}

class SyncManager {
  public static state: PushPullState = { timeOfLastSaveEvent: 0, mustPush: false, parentChangesetIndex: 0, changesOnServer: [], isSynchronizing: false };
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
      // const iModelId = this.briefcaseConnection.iModelId;
      try {
        // Bootstrap the process by finding out if there are newer changesets on the server already.
        // this.state.parentChangesetIndex = this.briefcaseConnection.changeset.index!;

        // if (!!this.state.parentChangesetIndex) {  // avoid error if imodel has no changesets.
        //   const allOnServer = SampleAppIModelApp.hubClient?.changesets.getMinimalList({
        //     iModelId,
        //     urlParams: {
        //       afterIndex: this.state.parentChangesetIndex,
        //     },
        //     authorization: AccessTokenAdapter.toAuthorizationCallback(await IModelHost.getAccessToken()),
        //   });
        //   // .get(accessToken, iModelId, new ChangeSetQuery().fromId(this.state.parentChangesetId));
        //   this.state.changesOnServer = allOnServer.map((changeset) => changeset.id!);

        //   this.onStateChange.raiseEvent();

        // Once the initial state of the briefcase is known, register for events announcing new changesets
        // const changeSetSubscription = await SampleAppIModelApp.hubClient?.events.subscriptions.create(accessToken, iModelId, ["ChangeSetPostPushEvent"]); // eslint-disable-line deprecation/deprecation

        // hubAccess.hubClient.events.createListener(async () => accessToken, changeSetSubscription.wsgId, iModelId, async (receivedEvent: ChangeSetPostPushEvent) => {
        //   if (receivedEvent.changeSetId !== this.state.parentChangesetId) {
        //     this.state.changesOnServer.push(receivedEvent.changeSetId);
        //     this.onStateChange.raiseEvent();
        //   }
        // });
        // }
      } catch (err: any) {
        UnexpectedErrors.handle(err);
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
      UnexpectedErrors.handle(err);
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
        const allChangesOnServer = this.state.changesOnServer.filter((cs) => cs !== parentChangeset.index);
        this.state.mustPush = false;
        this.state.changesOnServer = allChangesOnServer;
        this.state.parentChangesetIndex = parentChangeset.index;
        this.onStateChange.raiseEvent();
      });

      txns.onChangesPulled.addListener((parentChangeset) => {
        this.updateParentChangesetIndex(parentChangeset.index);
        this.onStateChange.raiseEvent();
      });
    }
  }

  private static updateParentChangesetIndex(parentChangesetIndex: number) {
    this.state.parentChangesetIndex = parentChangesetIndex;
    const lastPulledIdx = this.state.changesOnServer.findIndex((csId) => csId === parentChangesetIndex);
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
      const parentChangesetIndex = this.briefcaseConnection.changeset.index!;
      this.updateParentChangesetIndex(parentChangesetIndex);
    } catch (err: any) {
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, failmsg, err.message, OutputMessageType.Alert, OutputMessageAlert.Dialog));
    } finally {
      this.state.isSynchronizing = false;
      this.onStateChange.raiseEvent();
    }
  }
}

export class PushPullStatusField extends React.Component<CommonProps, PushPullState> {
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
      SyncManager.initializeLocalChangesListener().catch((err) => UnexpectedErrors.handle(err));
      SyncManager.initializeChangesetListener().catch((err) => UnexpectedErrors.handle(err));
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
        <StatusBarIndicator
          className={"simple-editor-app-statusFields-pushPull"}
          style={this.props.style}
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
        </StatusBarIndicator >
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
      <StatusBarIndicator
        className={"simple-editor-app-statusFields-pushPull"}
        style={this.props.style}
      >
        <div id="simple-editor-app-statusFields-pushPull-buttons">
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div title={pushTitleTxt} onClick={async () => SyncManager.syncChanges(true)}>
            <Icon iconSpec={pushIcon} />
          </div>
          <span> </span>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div title={pullTitleTxt} onClick={async () => SyncManager.syncChanges(false)}>
            {pullChangeCount}<Icon iconSpec={pullIcon} />
          </div>
        </div>
      </StatusBarIndicator>
    );
  }

}
