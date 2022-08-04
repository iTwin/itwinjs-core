/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { FrontstageManager } from "@itwin/appui-react";
import { WidgetApiStage } from "@itwin/appui-test-providers";

import { openBlankConnection } from "./appui/BlenkConnection";

export function useHandleURLParams() {
  const [frontstage, setFrontstage] = React.useState<string | null>(null);
  React.useEffect(() => {
    void (async function () {
      const queryString = window.location.search;
      const params = new URLSearchParams(queryString);
      setFrontstage(params.get("frontstage"));
    })();
  }, []);
  React.useEffect(() => {
    let frontstageId: string | undefined;
    switch (frontstage) {
      case "widgets": {
        frontstageId = WidgetApiStage.stageId;
        break;
      }
    }
    if (!frontstageId)
      return;

    void (async function () {
      const frontstageDef = await FrontstageManager.getFrontstageDef(frontstageId);
      if (!frontstageDef)
        return;
      await openBlankConnection();
      await FrontstageManager.setActiveFrontstageDef(frontstageDef);
    })();
  }, [frontstage]);
}
