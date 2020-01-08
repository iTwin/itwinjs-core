/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/// <reference types="node" />

declare module 'https-proxy-agent' {

  import { Agent } from 'https';
  import { Url } from 'url';

  declare class HttpsProxyAgent extends Agent {
    public constructor(options: string | Url);
    public proxy: Url;
    public secureProxy: boolean;
  }

  export = HttpsProxyAgent;
}

