/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import { ITwinSettingsError } from "@itwin/core-common";
import { GuidString } from "@itwin/core-bentley";
import { IModelHost } from "../../IModelHost";
import { settingsWorkspaceDbName } from "../../workspace/SettingsDb";
import { SettingsContainers } from "../../workspace/SettingsEditor";
import { BlobContainer } from "../../BlobContainerService";
import { constructWorkspaceEditor } from "./WorkspaceImpl";
import { EditableWorkspaceContainer, WorkspaceEditor } from "../../workspace/WorkspaceEditor";

/** Obtain a [[WorkspaceEditor]] targeting the single existing settings container for a given iTwin.
 * Returns `undefined` if no container exists. Throws if multiple containers are found.
 * @internal
 */
export async function getSettingsEditorForITwin(iTwinId: GuidString): Promise<{ editor: WorkspaceEditor; container: EditableWorkspaceContainer } | undefined> {
  const containerId = await SettingsContainers.getITwinContainerId(iTwinId);
  if (undefined === containerId)
    return undefined;

  const editor = constructWorkspaceEditor();
  try {
    const userToken = await IModelHost.getAccessToken();
    const tokenProps = await BlobContainer.service?.requestToken({ accessLevel: "write", containerId, userToken });
    if (!tokenProps)
      ITwinSettingsError.throwError("failed-to-obtain-container-token", { message: `Failed to obtain access token for iTwin settings container '${containerId}'.`, iTwinId });

    const container = editor.getContainer({
      accessToken: tokenProps.token,
      baseUri: tokenProps.baseUri,
      containerId,
      storageType: tokenProps.provider,
      writeable: true,
    });

    return { editor, container };
  } catch (error) {
    editor.close();
    throw error;
  }
}

/** Construct a [[WorkspaceEditor]] targeting the single settings container for a given iTwin.
 * If no container exists, one is created with default metadata. Throws if multiple containers are found.
 * @internal
 */
export async function constructSettingsEditorForITwin(iTwinId: GuidString): Promise<{ editor: WorkspaceEditor; container: EditableWorkspaceContainer }> {
  const existing = await getSettingsEditorForITwin(iTwinId);
  if (existing)
    return existing;

  const editor = constructWorkspaceEditor();
  try {
    const container = await editor.createNewCloudContainer({
      scope: { iTwinId },
      metadata: {
        label: "iTwin settings",
        description: `Default settings container for iTwin ${iTwinId}`,
      },
      containerType: "settings",
      dbName: settingsWorkspaceDbName,
      manifest: { workspaceName: `iTwin ${iTwinId} settings` },
    });

    return { editor, container };
  } catch (error) {
    editor.close();
    throw error;
  }
}
