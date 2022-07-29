/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./IModelOpen.scss";
import "./Common.scss";
import * as React from "react";
import { Project as ITwin, ProjectsAccessClient } from "@itwin/projects-client";
import { IModelApp } from "@itwin/core-frontend";
import { BackstageManager } from "@itwin/appui-react";
import { BasicIModelInfo, IModelInfo } from "../ExternalIModel";
import { ITwinDropdown } from "./ITwinDropdown";
import { IModelFull, IModelGrid } from "@itwin/imodel-browser-react";

/** Properties for the [[IModelOpen]] component */
export interface IModelOpenProps {
  onIModelSelected?: (iModelInfo: BasicIModelInfo) => void;
  initialIModels?: IModelInfo[];
}

/**
 * Open component showing iTwins and iModels
 */
export function IModelOpen(props: IModelOpenProps) {
  const [recentITwins, setRecentITwins] = React.useState<Array<ITwin>>([]);
  const [currentITwin, setCurrentITwin] = React.useState<ITwin | undefined>();
  const [accessToken, setAccessToken] = React.useState("");

  React.useEffect(() => {
    async function fetchAccessToken() {
      const token = await IModelApp.getAccessToken();
      setAccessToken(token);
    }
    fetchAccessToken(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }, []);

  React.useEffect(() => {
    async function fetchProjects() {
      const client = new ProjectsAccessClient();
      try {
        const iTwins = await client.getAll(accessToken, { pagination: { skip: 0, top: 30 } });
        setRecentITwins(iTwins);
        if (iTwins.length)
          setCurrentITwin(iTwins[0]);
      } catch { }
    }
    fetchProjects(); // eslint-disable-line @typescript-eslint/no-floating-promises
  }, [accessToken]);

  const selectITwin = React.useCallback(async (iTwin: ITwin) => {
    setCurrentITwin(iTwin);
  }, []);

  const onImodelSelect = React.useCallback(async (iModel: IModelFull) => {
    currentITwin && props.onIModelSelected && props.onIModelSelected({
      iTwinId: currentITwin.id,
      id: iModel.id,
      name: iModel.name ?? "unknown",
    });
  }, [currentITwin, props]);

  return (
    <>
      <div className="open-content-container">
        <div className="open-appbar">
          <div className="backstage-icon">
            <span className="icon icon-home" onPointerUp={() => BackstageManager.getBackstageToggleCommand()?.execute()} />
          </div>
          <div className="itwin-picker-content">
            <span className="itwins-label">iTwins</span>
            <div className="itwin-picker">
              <ITwinDropdown currentITwin={currentITwin} recentITwins={recentITwins} onITwinClicked={selectITwin} />
            </div>
          </div>
        </div>
        <div className="open-content">
          <div className="idp-scrolling-content">
            {currentITwin && <IModelGrid accessToken={accessToken} projectId={currentITwin.id} onThumbnailClick={onImodelSelect}
              apiOverrides={{ serverEnvironmentPrefix: "qa" }} />}
          </div>
        </div>
      </div>
    </>
  );
}
