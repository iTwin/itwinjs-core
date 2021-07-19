/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core";
import { Spinner, SpinnerSize } from "@bentley/ui-core";
import * as React from "react";

// eslint-disable-next-line @typescript-eslint/naming-convention
export function EsriOAuth2Callback() {

  const startLogin = () => {
    let success = false;
    if (window.opener !== undefined) {
      const opener = (window.opener as any);
      assert(opener?.esriOAuth2Callback);
      if (opener?.esriOAuth2Callback) {
        if (window.location.hash.length > 0) {
          const hashParams = new URLSearchParams(window.location.hash.substr(1));
          const token = hashParams.get("access_token") ?? undefined;
          const expiresIn = hashParams.get("expires_in") ?? undefined;
          const username = hashParams.get("username") ?? undefined;
          const ssl = hashParams.get("ssl") ?? undefined;
          const state = hashParams.get("state") ?? undefined;
          const persist = hashParams.get("persist") ?? undefined;

          if (token !== undefined && expiresIn !== undefined && state !== undefined ) {
            success = true;
            opener.esriOAuth2Callback(true, token, Number(expiresIn), username, (ssl ? ssl === "true" : ssl), state, (persist ? persist === "true" : persist));
          }
        }
        if (!success) {
          opener.esriOAuth2Callback(false);
        }
      }
    }
  };

  React.useEffect(() => {
    startLogin();
  }, []);

  return (
    <Spinner size={SpinnerSize.Medium }/>
  );
}
