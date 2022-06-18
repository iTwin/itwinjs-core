/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ProgressRadial } from "@itwin/itwinui-react";
import * as React from "react";

/** @beta */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function ArcGisOauthRedirect() {

  const completeLogin = () => {
    if (window.opener) {
      const opener = (window.opener);
      if (opener?.arcGisOAuth2Callback) {
        opener.arcGisOAuth2Callback(window.location);
      } else {
        // eslint-disable-next-line no-console
        console.log("ERROR: arcGisOAuth2Callback is not defined");
      }
    }
  };

  React.useEffect(() => {
    completeLogin();
  }, []);

  return (
    <ProgressRadial indeterminate={true}></ProgressRadial>
  );
}
