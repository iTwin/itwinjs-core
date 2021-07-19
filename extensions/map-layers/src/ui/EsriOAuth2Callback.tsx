/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core";
import { Spinner, SpinnerSize } from "@bentley/ui-core";
import * as React from "react";

// eslint-disable-next-line @typescript-eslint/naming-convention
export function EsriOAuth2Callback() {

  const completeLogin = () => {
    if (window.opener !== undefined) {
      const opener = (window.opener as any);
      assert(opener?.esriOAuth2Callback);
      if (opener?.esriOAuth2Callback) {
          opener.esriOAuth2Callback(window.location);
        }
      }
  };

  React.useEffect(() => {
    completeLogin();
  }, []);

  return (
    <Spinner size={SpinnerSize.Medium }/>
  );
}
