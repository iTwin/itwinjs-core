/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Introspection
 */

import { IntrospectionResponse } from "./IntrospectionResponse";

/* eslint-disable @typescript-eslint/naming-convention */

/** @internal */
export interface ImsIntrospectionResponse extends IntrospectionResponse {
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  ultimate_site?: string;
  org?: string;
  org_name?: string;
  usage_country_iso?: string;
  entitlement?: string[];
  role?: string[];
}
