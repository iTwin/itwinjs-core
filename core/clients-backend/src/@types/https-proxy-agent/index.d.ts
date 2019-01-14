/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
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

