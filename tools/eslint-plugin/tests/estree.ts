/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

namespace IMJSBackend {
  export interface ClientRequestContext {}
  export interface AuthorizedClientRequestContext extends ClientRequestContext {}
}

type ClientRequestContext = IMJSBackend.ClientRequestContext;
