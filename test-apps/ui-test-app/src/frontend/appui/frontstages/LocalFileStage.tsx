/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Id64String } from "@bentley/bentleyjs-core";
import { ViewDefinitionProps } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Button, ButtonSize, ButtonType, FillCentered, Headline } from "@bentley/ui-core";
import {
  ConfigurableCreateInfo, ContentControl, ContentGroup, CoreTools, Frontstage, FrontstageManager, FrontstageProps, FrontstageProvider, ToolWidget,
  UiFramework, Widget, Zone,
} from "@bentley/ui-framework";
import { SampleAppIModelApp } from "../..";
import { AppTools } from "../../tools/ToolSpecifications";
import { IModelViewPicker } from "../imodelopen/IModelViewPicker";
import { LocalFileSupport } from "../LocalFileSupport";

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
  public static async open() {
    if (LocalFileSupport.localFilesSupported()) {
      const frontstageProvider = new LocalFileOpenFrontstage();
      FrontstageManager.addFrontstageProvider(frontstageProvider);
      await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);
    }
  }

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const contentGroup: ContentGroup = new ContentGroup({
      contents: [
        {
          classId: LocalFileOpenControl,
        },
      ],
    });

    return (
      <Frontstage id="LocalFileOpen"
        defaultTool={CoreTools.selectElementCommand}
        defaultLayout="SingleContent"
        contentGroup={contentGroup}
        isInFooterMode={false}
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
  public render() {
    return (
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
}

/** LocalFilePage displays the file picker and view picker. */
class LocalFilePage extends React.Component<LocalFilePageProps, LocalFilePageState> {
  private _input: HTMLInputElement | null = null;

  public readonly state: Readonly<LocalFilePageState> = {
    iModelConnection: undefined,
  };

  public componentDidMount() {
    if (!this.state.iModelConnection && this._input) {
      this._clickInput();
    }
  }

  private _clickInput = () => {
    if (!this.state.iModelConnection && this._input) {
      this._input.click();
    }
  };

  private _handleChange = async (_e: React.ChangeEvent) => {
    if (this._input) {
      if (this._input.files && this._input.files.length) {
        const file: File = this._input.files[0];
        if (file) {
          const iModelConnection = await LocalFileSupport.openLocalFile(file.name, this.props.writable);
          if (iModelConnection) {
            SampleAppIModelApp.setIsIModelLocal(true, true);
            this.setState({ iModelConnection });
          }
        }
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

  public render() {
    if (!this.state.iModelConnection) {
      const title = UiFramework.i18n.translate("SampleApp:localFileStage.localFile");

      return (
        <>
          <div style={{ position: "absolute", top: "16px", left: "100px" }}>
            <Headline>{title}</Headline>
          </div>
          <FillCentered>
            <input id="file-input" ref={(e) => this._input = e}
              type="file" accept=".bim,.ibim" onChange={this._handleChange}
              style={{ display: "none" }} />
            <Button size={ButtonSize.Large} buttonType={ButtonType.Primary} onClick={this._clickInput}>
              {UiFramework.i18n.translate("SampleApp:localFileStage.selectFile")}
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
