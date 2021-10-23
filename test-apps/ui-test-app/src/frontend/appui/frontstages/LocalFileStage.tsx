/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Id64String } from "@itwin/core-bentley";
import { ViewDefinitionProps } from "@itwin/core-common";
import { IModelConnection } from "@itwin/core-frontend";

import { ElectronApp } from "@itwin/core-electron/lib/cjs/ElectronFrontend";
import { OpenDialogOptions } from "electron";

import { FillCentered } from "@itwin/core-react";
import {
  ConfigurableCreateInfo, ContentControl, ContentGroup, CoreTools, Frontstage, FrontstageManager,
  FrontstageProps, FrontstageProvider, ToolWidget, UiFramework, Widget, Zone,
} from "@itwin/appui-react";
import { SampleAppIModelApp } from "../..";
import { AppTools } from "../../tools/ToolSpecifications";
import { IModelViewPicker } from "../imodelopen/IModelViewPicker";
import { LocalFileSupport } from "../LocalFileSupport";
import { Button, Headline } from "@itwin/itwinui-react";
import { StageUsage, StandardContentLayouts } from "@itwin/appui-abstract";
import { hasSavedViewLayoutProps } from "../../tools/UiProviderTool";
import { ViewsFrontstage } from "./ViewsFrontstage";

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
    await SampleAppIModelApp.openViews(iModelConnection, views);
  };
}

/** LocalFileOpenFrontstage displays the file picker and view picker. */
export class LocalFileOpenFrontstage extends FrontstageProvider {
  public get id(): string {
    return "LocalFileOpen";
  }

  public static async open() {
    if (LocalFileSupport.localFilesSupported()) {
      const frontstageProvider = new LocalFileOpenFrontstage();
      FrontstageManager.addFrontstageProvider(frontstageProvider);
      const frontstageDef = await FrontstageManager.getFrontstageDef(frontstageProvider.frontstage.props.id);
      await FrontstageManager.setActiveFrontstageDef(frontstageDef);
    }
  }

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const contentGroup: ContentGroup = new ContentGroup({
      id: "LocalFileOpenGroup",
      layout: StandardContentLayouts.singleView,
      contents: [
        {
          id: "file-open",
          classId: LocalFileOpenControl,
        },
      ],
    });

    return (
      <Frontstage id={this.id}
        defaultTool={CoreTools.selectElementCommand}
        contentGroup={contentGroup}
        isInFooterMode={false}
        isIModelIndependent={true}
        usage={StageUsage.Private}
        contentManipulationTools={
          <Zone
            widgets={[
              <Widget isFreeform={true} element={<FrontstageToolWidget />} />, // eslint-disable-line react/jsx-key
            ]}
          />
        }
      />
    );
  }
}

/** Define a ToolWidget with Buttons to display in the TopLeft zone.
 */
class FrontstageToolWidget extends React.Component {
  public override render() {
    return (
      // eslint-disable-next-line deprecation/deprecation
      <ToolWidget
        appButton={AppTools.backstageToggleCommand}
      />
    );
  }
}

interface LocalFilePageProps {
  onViewsSelected: (iModelConnection: IModelConnection, views: Id64String[]) => void;
  onClose: () => void;
  writable: boolean;
}

interface LocalFilePageState {
  iModelConnection: IModelConnection | undefined;
  hasSavedContentGroup: boolean;
}

/** LocalFilePage displays the file picker and view picker. */
class LocalFilePage extends React.Component<LocalFilePageProps, LocalFilePageState> {
  private _input: HTMLInputElement | null = null;

  public override readonly state: Readonly<LocalFilePageState> = {
    iModelConnection: undefined,
    hasSavedContentGroup: false,
  };

  public override componentDidMount() {
    if (!this.state.iModelConnection) {
      if (ElectronApp.isValid) {
        this._handleElectronFileOpen(); // eslint-disable-line @typescript-eslint/no-floating-promises
      }
    }
  }

  private _handleButtonClick = () => {
    if (!this.state.iModelConnection) {
      if (ElectronApp.isValid) {
        this._handleElectronFileOpen(); // eslint-disable-line @typescript-eslint/no-floating-promises
      } else if (this._input) {
        this._input.click();
      }
    }
  };

  private _handleFileInputChange = async (_e: React.ChangeEvent) => {
    if (this._input) {
      if (this._input.files && this._input.files.length) {
        const file: File = this._input.files[0];
        if (file) {
          const iModelConnection = await LocalFileSupport.openLocalFile(file.name, this.props.writable);
          const hasSavedContentGroup = await hasSavedViewLayoutProps(ViewsFrontstage.stageId, iModelConnection);
          if (iModelConnection) {
            SampleAppIModelApp.setIsIModelLocal(true, true);
            this.setState({ iModelConnection, hasSavedContentGroup });
          }
        }
      }
    }
  };

  private _handleElectronFileOpen = async () => {
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
      const iModelConnection = await LocalFileSupport.openLocalFile(filePath, this.props.writable);
      const hasSavedContentGroup = await hasSavedViewLayoutProps(ViewsFrontstage.stageId, this.state.iModelConnection);
      if (iModelConnection) {
        SampleAppIModelApp.setIsIModelLocal(true, true);
        this.setState({ iModelConnection, hasSavedContentGroup });
      }
    }
  };

  private _handleClose = async (): Promise<void> => {
    if (this.state.iModelConnection)
      await this.state.iModelConnection.close();
    this.setState({ iModelConnection: undefined }, () => this.props.onClose());
  };

  private _handleViewsSelected = (views: ViewDefinitionProps[]): void => {
    const idsSelected = new Array<Id64String>();
    views.forEach((props: ViewDefinitionProps) => {
      if (props.id)
        idsSelected.push(props.id);
    });

    if (this.state.iModelConnection && idsSelected.length)
      this.props.onViewsSelected(this.state.iModelConnection, idsSelected);
  };

  public override render() {
    if (this.state.hasSavedContentGroup && this.state.iModelConnection) {
      this.props.onViewsSelected(this.state.iModelConnection, []);
      return null;
    }

    if (!this.state.iModelConnection) {
      const title = UiFramework.localization.getLocalizedString("SampleApp:localFileStage.localFile");

      return (
        <>
          <div style={{ position: "absolute", top: "16px", left: "100px" }}>
            <Headline>{title}</Headline>
          </div>
          <FillCentered>
            {!ElectronApp.isValid &&
              <input id="file-input" ref={(e) => this._input = e}
                type="file" accept=".bim,.ibim" onChange={this._handleFileInputChange}
                style={{ display: "none" }} />
            }
            <Button size="large" styleType="cta" onClick={this._handleButtonClick}>
              {UiFramework.localization.getLocalizedString("SampleApp:localFileStage.selectFile")}
            </Button>
          </FillCentered >
        </>
      );
    } else {
      return (
        <IModelViewPicker iModelConnection={this.state.iModelConnection}
          onClose={this._handleClose} onViewsSelected={this._handleViewsSelected} />
      );
    }
  }
}
