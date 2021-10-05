/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Introspection
 */

import { IntrospectionResponse as OpenIdIntrospectionResponse } from "openid-client";

/** @alpha */
export interface IntrospectionResponse extends OpenIdIntrospectionResponse {
  sub?: string; // sub is an official optional parameter of OAuth introspection responses: https://tools.ietf.org/html/rfc7662
}
