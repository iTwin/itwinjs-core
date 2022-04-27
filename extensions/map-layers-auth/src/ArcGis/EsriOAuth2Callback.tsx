/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ProgressRadial } from "@itwin/itwinui-react";
import * as React from "react";

// eslint-disable-next-line @typescript-eslint/naming-convention
export function EsriOAuth2Callback() {

  const completeLogin = () => {
    if (window.opener) {
      const opener = (window.opener );
      if (opener?.esriOAuth2Callback) {
        opener.esriOAuth2Callback(window.location);
      } else {
        // eslint-disable-next-line no-console
        console.log("ERROR: esriOAuth2Callback is not defined");
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
