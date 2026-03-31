/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import { ITwinSettingsError } from "@itwin/core-common";
import { GuidString } from "@itwin/core-bentley";
import { GetWorkspaceContainerArgs, WorkspaceContainerId } from "./Workspace";
import { BlobContainer } from "../BlobContainerService";
import { IModelHost } from "../IModelHost";
import { constructSettingsEditorForITwin, getSettingsEditorForITwin } from "../internal/workspace/SettingsEditorImpl";
import { EditableWorkspaceContainer, WorkspaceEditor } from "./WorkspaceEditor";

/** The default resource name used to store settings in a [[WorkspaceDb]].
 * This is the key under which all settings are stored in the SQLite `strings` table.
 * When loading settings at runtime via [[Workspace.loadSettingsDictionary]], the `resourceName` defaults
 * to this value, ensuring the read and write paths always agree on which key to use.
 * @internal
 */
export const settingsResourceName = "settingsDictionary";

/** @internal */
export namespace SettingsEditor {
  /** The type of workspace container used to store settings. */
  export const containerType = "settings";

  /**
   * Create a new [[SettingsEditor]] for creating new versions of [[SettingsDb]]s.
   * @note The caller becomes the owner of the SettingsEditor and is responsible for calling [[SettingsEditor.close]] on it when finished.
   * @note It is illegal to have more than one SettingsEditor active in a single session.
   */
  export async function constructForITwin(iTwinId: GuidString): Promise<{ editor: WorkspaceEditor; container: EditableWorkspaceContainer }> {
    return constructSettingsEditorForITwin(iTwinId);
  }

  /**
   * Obtain a [[SettingsEditor]] for the existing settings container associated with an iTwin.
   * @returns The editor and container, or `undefined` if no settings container exists for the iTwin.
   * @note The caller becomes the owner of the SettingsEditor and is responsible for calling [[SettingsEditor.close]] on it when finished.
   * @note It is illegal to have more than one SettingsEditor active in a single session.
   */
  export async function getForITwin(iTwinId: GuidString): Promise<{ editor: WorkspaceEditor; container: EditableWorkspaceContainer } | undefined> {
    return getSettingsEditorForITwin(iTwinId);
  }
}

/**
 * Help locate and obtain access to known containers with type "settings".
 * @internal
 */
export namespace SettingsContainers {
  /** Arguments for [[SettingsContainers.queryContainers]]. */
  export interface QueryArgs {
    /** The iTwinId whose settings containers should be queried. */
    iTwinId: GuidString;
    /** Optional label filter. */
    label?: string;
  }

  /**
   * Query the [[BlobContainer]] service for all settings containers associated with a given iTwin.
   * Automatically filters by `containerType: "settings"`.
   * @note Requires [[IModelHost.authorizationClient]] to be configured.
   */
  export async function queryContainers(args: QueryArgs): Promise<BlobContainer.MetadataResponse[]> {
    if (undefined === BlobContainer.service)
      ITwinSettingsError.throwError("blob-service-unavailable", { message: "BlobContainer.service is not available." });

    const userToken = await IModelHost.getAccessToken();
    return BlobContainer.service.queryContainersMetadata(userToken, { ...args, containerType: SettingsEditor.containerType });
  }

  /**
   * Query the [[BlobContainer]] service for the single settings container associated with a given iTwin.
   * @returns The containerId, or `undefined` if no container exists.
   * @throws if more than one settings container is found.
   */
  export async function getITwinContainerId(iTwinId: GuidString): Promise<WorkspaceContainerId | undefined> {
    const containers = await queryContainers({ iTwinId });
    if (containers.length > 1) {
      ITwinSettingsError.throwError("multiple-itwin-settings-containers", {
        message: `Multiple iTwin settings containers were found for '${iTwinId}', so a container cannot be automatically selected.`,
        iTwinId,
      });
    }
    return containers[0]?.containerId;
  }

  /**
   * Look up the single settings container for an iTwin and obtain a read-only access token for it.
   * @returns The container props needed by [[IModelHost.getITwinWorkspace]], or `undefined` if no settings container exists.
   * @throws if more than one settings container is found.
   * @note Requires [[BlobContainer.service]] to be configured.
   */
  export async function getITwinContainerProps(iTwinId: GuidString): Promise<GetWorkspaceContainerArgs | undefined> {
    const containerId = await getITwinContainerId(iTwinId);
    if (undefined === containerId)
      return undefined;

    if (undefined === BlobContainer.service)
      ITwinSettingsError.throwError("blob-service-unavailable", { message: "BlobContainer.service is not available." });

    const tokenProps = await BlobContainer.service.requestToken({ accessLevel: "read", containerId, userToken: await IModelHost.getAccessToken() });
    if (undefined === tokenProps)
      return undefined;

    return { containerId, baseUri: tokenProps.baseUri, storageType: tokenProps.provider, accessToken: tokenProps.token };
  }
}
