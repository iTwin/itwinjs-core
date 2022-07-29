/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import * as React from "react";
import { OpenDialogOptions } from "electron";
import { BackstageItem, BackstageItemUtilities, ConditionalBooleanValue, StageUsage, StandardContentLayouts, UiItemsManager, UiItemsProvider } from "@itwin/appui-abstract";
import {
  BackstageAppButton,
  ConfigurableCreateInfo, ConfigurableUiManager, ContentControl, ContentGroupProps, FrontstageManager,
  StandardFrontstageProps, StandardFrontstageProvider, UiFramework,
} from "@itwin/appui-react";
import { BentleyError, Id64String, Logger } from "@itwin/core-bentley";
import { Cartographic, ColorDef, IModelReadRpcInterface, RenderMode, ViewQueryParams } from "@itwin/core-common";
import { ElectronApp } from "@itwin/core-electron/lib/cjs/ElectronFrontend";
import { BlankConnection, IModelApp, IModelConnection, SpatialViewState } from "@itwin/core-frontend";
import { Range3d } from "@itwin/core-geometry";
import { FillCentered } from "@itwin/core-react";
import { Button, Headline } from "@itwin/itwinui-react";

import { SampleAppIModelApp, SampleAppUiActionId } from "../..";
import { LocalFileSupport } from "../LocalFileSupport";

async function getDefaultViewId(iModelConnection: IModelConnection): Promise<Id64String | undefined> {
  const requestedViewId = process.env.IMJS_UITESTAPP_IMODEL_VIEWID;
  // try specified viewId first
  if (requestedViewId) {
    const queryParams: ViewQueryParams = {};
    queryParams.from = SpatialViewState.classFullName;
    queryParams.where = `ECInstanceId=${requestedViewId}`;
    const vwProps = await IModelReadRpcInterface.getClient().queryElementProps(iModelConnection.getRpcProps(), queryParams);
    if (vwProps.length !== 0) {
      return requestedViewId;
    }
  }

  const viewId = await iModelConnection.views.queryDefaultViewId();
  const params: ViewQueryParams = {};
  params.from = SpatialViewState.classFullName;
  params.where = `ECInstanceId=${viewId}`;

  // Check validity of default view
  const viewProps = await IModelReadRpcInterface.getClient().queryElementProps(iModelConnection.getRpcProps(), params);
  if (viewProps.length === 0) {
    // Return the first view we can find
    const viewList = await iModelConnection.views.getViewList({ wantPrivate: false });
    if (viewList.length === 0)
      return undefined;

    const spatialViewList = viewList.filter((value: IModelConnection.ViewSpec) => value.class.indexOf("Spatial") !== -1);
    if (spatialViewList.length === 0)
      return undefined;

    return spatialViewList[0].id;
  }

  return viewId;
}

class LocalFileOpenControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactNode = <LocalFilePage onClose={this._handleClose} onViewsSelected={this._handleViewsSelected} writable={SampleAppIModelApp.allowWrite} />;
  }

  private _handleClose = () => {
    FrontstageManager.closeModalFrontstage();
  };

  private _handleViewsSelected = async (iModelConnection: IModelConnection, views: Id64String[]) => {
    FrontstageManager.closeModalFrontstage();
    await SampleAppIModelApp.setViewIdAndOpenMainStage(iModelConnection, views);
  };
}

export class LocalFileOpenFrontstage {
  public static stageId = "appui-test-app:LocalFileOpen";

  public static async open() {
    let fullBimFileName = LocalFileSupport.getLocalFileSpecification();

    if (LocalFileSupport.localFilesSupported() || fullBimFileName) {
      // if frontstage has not yet been registered register it now
      if (!FrontstageManager.hasFrontstage(LocalFileOpenFrontstage.stageId)) {
        const contentGroupProps: ContentGroupProps = {
          id: "appui-test-app:LocalFileOpenGroup",
          layout: StandardContentLayouts.singleView,
          contents: [
            {
              id: "file-open",
              classId: LocalFileOpenControl,
            },
          ],
        };

        const stageProps: StandardFrontstageProps = {
          id: LocalFileOpenFrontstage.stageId,
          version: 1.0,
          contentGroupProps,
          cornerButton: <BackstageAppButton />,
          usage: StageUsage.Private,
          hideToolSettings: true,
          hideStatusBar: true,
        };

        ConfigurableUiManager.addFrontstageProvider(new StandardFrontstageProvider(stageProps));
        UiItemsManager.register(new LocalFileOpenStageBackstageItemsProvider());
      } else {
        // if stage has already been register then this is not the initial startup of the app so don't use the file spec from the environment.
        fullBimFileName = undefined;
      }
    }

    // if the full bim file has been specified try to open it now
    if (fullBimFileName) {
      const connection = await LocalFileSupport.openLocalFile(fullBimFileName, SampleAppIModelApp.allowWrite, true);
      if (connection) {
        SampleAppIModelApp.setIsIModelLocal(true, true);
        const viewId = await getDefaultViewId(connection);
        if (undefined !== viewId) {
          await SampleAppIModelApp.setViewIdAndOpenMainStage(connection, [viewId]);
          return;
        }
      }
    }

    if (LocalFileSupport.localFilesSupported()) {
      const frontstageDef = await FrontstageManager.getFrontstageDef(LocalFileOpenFrontstage.stageId);
      await FrontstageManager.setActiveFrontstageDef(frontstageDef);
    }
  }
}

class LocalFileOpenStageBackstageItemsProvider implements UiItemsProvider {
  public readonly id = "local-file-open-stage-backstageItemProvider";

  public provideBackstageItems(): BackstageItem[] {
    // hide option in backstage if snapshotPath is not set
    const openLocalFileHidden = new ConditionalBooleanValue(() => SampleAppIModelApp.testAppConfiguration?.snapshotPath === undefined, [SampleAppUiActionId.setIsIModelLocal]);
    return [
      BackstageItemUtilities.createActionItem(LocalFileOpenFrontstage.stageId, 300, 30, async () => LocalFileOpenFrontstage.open(), IModelApp.localization.getLocalizedString("SampleApp:backstage:fileSelect"), undefined, "icon-placeholder", { isHidden: openLocalFileHidden }),
    ];
  }
}

interface LocalFilePageProps {
  onViewsSelected: (iModelConnection: IModelConnection, views: Id64String[]) => void;
  onClose: () => void;
  writable: boolean;
}

/** LocalFilePage displays the file picker and view picker. */
function LocalFilePage(props: LocalFilePageProps) {
  const { onViewsSelected, writable } = props;

  const title = React.useRef(UiFramework.localization.getLocalizedString("SampleApp:localFileStage.localFile"));
  const buttonLabel = React.useRef(UiFramework.localization.getLocalizedString("SampleApp:localFileStage.selectFile"));
  const isElectronApp = React.useRef(ElectronApp.isValid);
  const filePickerElement = React.useRef<HTMLInputElement | null>(null);

  const handleFileInputChange = React.useCallback(async (_e: React.ChangeEvent) => {
    if (filePickerElement.current && filePickerElement.current.files && filePickerElement.current.files.length) {
      const file: File = filePickerElement.current.files[0];
      if (file) {
        const connection = await LocalFileSupport.openLocalFile(file.name, writable, false);
        // const hasSavedContent = await hasSavedViewLayoutProps(MainFrontstage.stageId, connection);
        if (connection) {
          SampleAppIModelApp.setIsIModelLocal(true, true);
          const viewId = await getDefaultViewId(connection);
          if (undefined !== viewId)
            onViewsSelected(connection, [viewId]);
        }
      }
    }
  }, [onViewsSelected, writable]);

  const handleElectronFileOpen = React.useCallback(async () => {
    const opts: OpenDialogOptions = {
      properties: ["openFile"],
      filters: [
        { name: "iModels", extensions: ["ibim", "bim"] },
      ],
    };
    const val = await ElectronApp.callDialog("showOpenDialog", opts);
    if (val.canceled)
      return;

    const filePath = val.filePaths[0];
    if (filePath) {
      const connection = await LocalFileSupport.openLocalFile(filePath, writable, true);
      if (connection) {
        SampleAppIModelApp.setIsIModelLocal(true, true);
        const viewId = await getDefaultViewId(connection);
        if (undefined !== viewId)
          onViewsSelected(connection, [viewId]);
      }
    }
  }, [onViewsSelected, writable]);

  const handleButtonClick = React.useCallback(async () => {
    if (isElectronApp.current) {
      await handleElectronFileOpen();
    } else if (filePickerElement.current) {
      filePickerElement.current.click();
    }
  }, [handleElectronFileOpen]);

  const handleBlankConnectionClick = async () => {
    const connection = await openBlankConnection();
    if (!connection)
      return;

    SampleAppIModelApp.setIsIModelLocal(true, true);
    const viewState = await createBlankViewState(connection);
    UiFramework.setDefaultViewState(viewState, true);
    onViewsSelected(connection, []);
  };
  return (
    <>
      <div style={{ position: "absolute", top: "16px", left: "100px" }}>
        <Headline>{title.current}</Headline>
      </div>
      <FillCentered style={{ flexDirection: "column", gap: "12px" }}>
        <FillCentered style={{ height: "unset" }}>
          {!isElectronApp.current &&
          <input id="file-input" ref={filePickerElement}
            type="file" accept=".bim,.ibim" onChange={handleFileInputChange}
            style={{ display: "none" }} />
          }
          <Button size="large" styleType="cta" onClick={handleButtonClick}>
            {buttonLabel.current}
          </Button>
        </FillCentered >
        <Button onClick={handleBlankConnectionClick}>
          Blank Connection
        </Button>
      </FillCentered >
    </>
  );
}

async function openBlankConnection(): Promise<IModelConnection | undefined> {
  // Close the current iModelConnection
  await SampleAppIModelApp.closeCurrentIModel();

  // Open the connection
  Logger.logInfo(SampleAppIModelApp.loggerCategory(LocalFileSupport), `openBlankConnection: Opening blank connection.`);
  try {
    return BlankConnection.create({
      name: "Exton PA",
      location: Cartographic.fromDegrees({longitude: -75.686694, latitude: 40.065757, height: 0}),
      extents: new Range3d(-1000, -1000, -100, 1000, 1000, 100),
    });
  } catch (error: unknown) {
    alert(BentleyError.getErrorMessage(error));
  }

  return undefined;
}

async function createBlankViewState(iModel: IModelConnection) {
  const ext = iModel.projectExtents;
  const viewState = SpatialViewState.createBlank(
    iModel,
    ext.low,
    ext.high.minus(ext.low)
  );

  viewState.setAllow3dManipulations(true);

  viewState.displayStyle.backgroundColor = ColorDef.white;
  const flags = viewState.viewFlags.copy({
    grid: false,
    renderMode: RenderMode.SmoothShade,
    backgroundMap: false,
  });
  viewState.displayStyle.viewFlags = flags;

  IModelApp.viewManager.onViewOpen.addOnce((vp) => {
    if (vp.view.hasSameCoordinates(viewState)) {
      vp.applyViewState(viewState);
    }
  });

  return viewState;
}
