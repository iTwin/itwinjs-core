/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyError, GuidString, IModelStatus, ProcessDetector } from "@itwin/core-bentley";
import { BriefcaseDownloader, IModelError, LocalBriefcaseProps, SyncMode } from "@itwin/core-common";
import { BriefcaseConnection, DownloadBriefcaseOptions, IModelConnection, NativeApp, SnapshotConnection } from "@itwin/core-frontend";
import { getConfigurationBoolean } from "./DisplayTestApp";

export interface OpenFileIModelProps {
  fileName: string;
  iModelId?: undefined;
  iTwinId?: undefined;
  writable: boolean;
}

export interface OpenHubIModelProps {
  fileName?: undefined;
  iModelId: GuidString;
  iTwinId: GuidString;
  writable: boolean;
}

export type OpenIModelProps = OpenFileIModelProps | OpenHubIModelProps;

async function downloadIModel(iModelId: GuidString, iTwinId: GuidString): Promise<LocalBriefcaseProps> {
  if (!ProcessDetector.isNativeAppFrontend) {
    throw new Error("Download requires native app (Electron, iOS, or Android)");
  }
  const opts: DownloadBriefcaseOptions = { syncMode: SyncMode.PullOnly };
  let downloader: BriefcaseDownloader | undefined;
  try {
    downloader = await NativeApp.requestDownloadBriefcase(iTwinId, iModelId, opts, undefined);

    // Wait for the download to complete.
    await downloader.downloadPromise;
    const localBriefcases = await NativeApp.getCachedBriefcases(iModelId);
    if (localBriefcases.length === 0) {
      // This should never happen, since we just downloaded it, but check, just in case.
      throw new Error("Error downloading iModel.");
    }
    return localBriefcases[0];
  } catch (error) {
    if (error instanceof BentleyError) {
      if (error.errorNumber === IModelStatus.FileAlreadyExists) {
        // When a download is canceled, the partial briefcase file does not get deleted, which causes
        // any subsequent download attempt to fail with this error number. If that happens, delete the
        // briefcase and try again.
        // When syncMode is SyncMode.PullOnly (which is what we use), briefcaseId is ALWAYS 0, so try
        // to delete the existing file using that briefcaseId.
        const filename = await NativeApp.getBriefcaseFileName({ iModelId, briefcaseId: 0 });
        await NativeApp.deleteBriefcase(filename);
        return downloadIModel(iModelId, iTwinId);
      }
    }
    throw error;
  }
}

export async function openIModel(props: OpenIModelProps): Promise<IModelConnection> {
  const { fileName, writable } = props;
  if (fileName !== undefined) {
    return openIModelFile(fileName, writable);
  } else {
    // Since fileName is required to be defined in OpenFileIModelProps, the fact that it is
    // undefined means that props must be of type OpenHubIModelProps, (which the compiler knows).
    const { iModelId, iTwinId } = props;
    return openHubIModel(iModelId, iTwinId, writable);
  }
}

async function openIModelFile(fileName: string, _writable: boolean): Promise<IModelConnection> {
  // try {
    return await BriefcaseConnection.openFile({ fileName, readonly: true, watchForChanges: true, key: fileName });
  // } catch (err) {
  //   if (writable && err instanceof IModelError && err.errorNumber === IModelStatus.ReadOnly)
  //     return SnapshotConnection.openFile(fileName);
  //   else
  //     throw err;
  // }
}

async function openHubIModel(iModelId: GuidString, iTwinId: GuidString, writable: boolean): Promise<IModelConnection> {
  const localBriefcases = await NativeApp.getCachedBriefcases(iModelId);
  if (localBriefcases.length > 0) {
    const fileName = await NativeApp.getBriefcaseFileName({ iModelId, briefcaseId: 0 });
    if (getConfigurationBoolean("ignoreCache")) {
      await NativeApp.deleteBriefcase(fileName);
    } else {
      return openIModel({ fileName, writable });
    }
  }
  const briefcaseProps = await downloadIModel(iModelId, iTwinId);
  return openIModelFile(briefcaseProps.fileName, writable);
}
