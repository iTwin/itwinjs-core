/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2019 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { CoreTools, ContentGroup, ContentControl, ConfigurableUiManager, ConfigurableCreateInfo,
         FrontstageProvider, FrontstageProps, Frontstage, IModelInfo, ProjectInfo } from "@bentley/ui-framework";
import { SampleAppIModelApp } from "../../index";
import { Config } from "@bentley/imodeljs-clients";
import { LoadingSpinner } from "@bentley/ui-core";

class DefaultIModelControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this._openDefaultIModel();

    const containerStyle: React.CSSProperties = {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%,-50%)",
    };

    super.reactElement = <div style={containerStyle}><LoadingSpinner message="Opening default iModel..." /></div>;
  }

  // called after the user has signed in (or access token is still valid)
  private _openDefaultIModel = () => {

    // get the default IModel (from imodejs-config)
    let defaultImodel: IModelInfo | undefined;

    let viewId: string | undefined;
    if (Config.App.has("imjs_uitestapp_imodel_viewId"))
      viewId = Config.App.get("imjs_uitestapp_imodel_viewId");

    if (Config.App.has("imjs_uitestapp_imodel_name") &&
      Config.App.has("imjs_uitestapp_imodel_wsgId") &&
      Config.App.has("imjs_uitestapp_imodel_project_name") &&
      Config.App.has("imjs_uitestapp_imodel_project_projectNumber") &&
      Config.App.has("imjs_uitestapp_imodel_project_wsgId")) {
      const defaultProject = {
        name: Config.App.get("imjs_uitestapp_imodel_project_name"),
        projectNumber: Config.App.get("imjs_uitestapp_imodel_project_projectNumber"),
        wsgId: Config.App.get("imjs_uitestapp_imodel_project_wsgId"),
        readStatus: 0,
      } as ProjectInfo;

      defaultImodel = {
        name: Config.App.get("imjs_uitestapp_imodel_name"),
        description: Config.App.get("imjs_uitestapp_imodel_name"),
        wsgId: Config.App.get("imjs_uitestapp_imodel_wsgId"),
        projectInfo: defaultProject,
        status: "",
      } as IModelInfo;

      if (defaultImodel) {
        if (viewId) {
          // open directly into the iModel (view)
          SampleAppIModelApp.openViews (defaultImodel.projectInfo.wsgId, defaultImodel.wsgId, [viewId!]); // tslint:disable-line:no-floating-promises
        } else {
          // open to the IModelIndex frontstage
          SampleAppIModelApp.showIModelIndex(defaultImodel.projectInfo.wsgId, defaultImodel.wsgId); // tslint:disable-line:no-floating-promises
        }
      } else {
         // open to the IModelOpen frontstage
        SampleAppIModelApp.showIModelOpen([defaultImodel]); // tslint:disable-line:no-floating-promises
      }
    }
  }
}

ConfigurableUiManager.registerControl("DefaultIModelControl", DefaultIModelControl);

export class DefaultIModelFrontstage extends FrontstageProvider {

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const contentGroup: ContentGroup = new ContentGroup({
        contents: [
          {
            classId: "DefaultIModelControl",
          },
        ],
      });

    return (
      <Frontstage id="DefaultIModel"
        defaultTool={CoreTools.selectElementCommand}
        defaultLayout="SingleContent"
        contentGroup={contentGroup}
        isInFooterMode={false}
        />
    );
  }
}
