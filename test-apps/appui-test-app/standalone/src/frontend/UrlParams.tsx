/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { UiFramework } from "@itwin/appui-react";

import { openBlankConnection } from "./appui/BlankConnection";

export function useHandleURLParams() {
  const [frontstageId, setFrontstageId] = React.useState<string | null>(null);
  React.useEffect(() => {
    const queryString = window.location.search;
    const params = new URLSearchParams(queryString);
    setFrontstageId(params.get("frontstage"));
  }, []);
  React.useEffect(() => {
    if (!frontstageId)
      return;

    void (async function () {
      const frontstageDef = await UiFramework.frontstages.getFrontstageDef(frontstageId);
      if (!frontstageDef)
        return;
      await openBlankConnection();
      await UiFramework.frontstages.setActiveFrontstageDef(frontstageDef);
    })();
  }, [frontstageId]);
}
