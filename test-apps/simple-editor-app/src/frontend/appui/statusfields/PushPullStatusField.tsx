/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority, OutputMessageType, OutputMessageAlert, EventSourceManager, AuthorizedFrontendRequestContext, IModelConnection } from "@bentley/imodeljs-frontend";
import { IModelWriteRpcInterface } from "@bentley/imodeljs-common";
import { ChangeSetPostPushEvent, ChangeSetQuery } from "@bentley/imodeljs-clients";
import { Spinner, SpinnerSize, Icon } from "@bentley/ui-core";
import { UiFramework, StatusFieldProps } from "@bentley/ui-framework";
import { ErrorHandling } from "../../api/ErrorHandling";
import { BeEvent } from "@bentley/bentleyjs-core";
import { FooterIndicator } from "@bentley/ui-ninezone";
import "./PushPullField.scss";

function translate(prompt: string) {
  return IModelApp.i18n.translate("SampleApp:statusFields." + prompt);
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

  public static get iModelConnection(): IModelConnection {
    return UiFramework.getIModelConnection()!;
  }

  public static async initializeChangesetListener() {
    if (this.changesetListenerInitialized)
      return;
    this.changesetListenerInitialized = true;

    const iModelId = this.iModelConnection.iModelToken.iModelId!;
    try {
      const requestContext = await AuthorizedFrontendRequestContext.create();

      // Bootstrap the process by finding out if there are newer changesets on the server already.
      this.state.parentChangesetId = await this.iModelConnection.editing.getParentChangeset();

      const allOnServer = await IModelApp.iModelClient.changeSets.get(requestContext, iModelId, new ChangeSetQuery().fromId(this.state.parentChangesetId));
      this.state.changesOnServer = allOnServer.map((changeset) => changeset.id!);

      this.onStateChange.raiseEvent();

      // Once the initial state of the briefcase is known, register for events announcing new changesets
      const changeSetSubscription = await IModelApp.iModelClient.events.subscriptions.create(requestContext, iModelId, ["ChangeSetPostPushEvent"]);

      IModelApp.iModelClient.events.createListener(requestContext, async () => requestContext.accessToken, changeSetSubscription.wsgId, iModelId, async (receivedEvent: ChangeSetPostPushEvent) => {
        if (receivedEvent.changeSetId !== this.state.parentChangesetId) {
          this.state.changesOnServer.push(receivedEvent.changeSetId!);
          this.onStateChange.raiseEvent();
        }
      });
    } catch (err) {
      ErrorHandling.onUnexpectedError(err);
    }

  }

  public static async initializeLocalChangesListener() {
    if (this.localChangesListenerInitialized)
      return;
    this.localChangesListenerInitialized = true;
    try {
      // Bootstrap the process by finding out if the briefcase has local txns already.
      this.state.mustPush = await this.iModelConnection.editing.hasPendingTxns();
    } catch (err) {
      ErrorHandling.onUnexpectedError(err);
    }

    this.onStateChange.raiseEvent();

    // Once the initial state of the briefcase is known, register for events announcing new txns and pushes that clear local txns.

    EventSourceManager.get(this.iModelConnection.iModelToken.key!).on(IModelWriteRpcInterface.name, "onSavedChanges", (data: any) => {
      if (data.time > this.state.timeOfLastSaveEvent) { // work around out-of-order events
        this.state.timeOfLastSaveEvent = data.time;
        this.state.mustPush = data.hasPendingTxns;
        this.onStateChange.raiseEvent();
      }
    });

    EventSourceManager.get(this.iModelConnection.iModelToken.key!).on(IModelWriteRpcInterface.name, "onPushedChanges", (data: any) => {
      // In case I got the changeSetSubscription event first, remove the changeset that I pushed from the list of server changes waiting to be merged.
      const allChangesOnServer = this.state.changesOnServer.filter((cs) => cs !== data.parentChangeSetId);
      this.state.mustPush = false;
      this.state.changesOnServer = allChangesOnServer;
      this.state.parentChangesetId = data.parentChangeSetId;
      this.onStateChange.raiseEvent();
    });

    EventSourceManager.get(this.iModelConnection.iModelToken.key!).on(IModelWriteRpcInterface.name, "onPulledChanges", (data: any) => {
      this.updateParentChangesetId(data.parentChangeSetId);
      this.onStateChange.raiseEvent();

      // TODO: Remove this when we get tile healing
      IModelApp.viewManager.refreshForModifiedModels(undefined);
    });
  }

  private static updateParentChangesetId(parentChangeSetId: string) {
    this.state.parentChangesetId = parentChangeSetId;
    const lastPulledIdx = this.state.changesOnServer.findIndex((csid) => csid === parentChangeSetId);
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
      const parentChangesetId = await this.iModelConnection.editing.concurrencyControl.pullMergePush("", doPush);
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
    const pullChangeCount = (this.state.changesOnServer.length !== 0) ? this.state.changesOnServer.length + "" : "";
    const pullTitleTxt = translate(mustPull ? "pullButtonTitle" : "pullButtonDisabledTitle");

    return (
      <FooterIndicator
        className={"simple-editor-app-statusFields-pushPull"}
        style={this.props.style}
        isInFooterMode={this.props.isInFooterMode}
      >
        <div id="simple-editor-app-statusFields-pushPull-buttons">
          <div title={pushTitleTxt} onClick={() => SyncManager.syncChanges(true)}>
            <Icon iconSpec={pushIcon} />
          </div>
          <span> </span>
          <div title={pullTitleTxt} onClick={() => SyncManager.syncChanges(false)}>
            {pullChangeCount}<Icon iconSpec={pullIcon} />
          </div>
        </div>
      </FooterIndicator>
    );
  }

}
