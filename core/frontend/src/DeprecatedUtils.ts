/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

// This file contains nothing except APIs from the Utils documentation group that have been deprecated.
// Don't use these deprecated APIs.
// Don't add anything to this file that is not a deprecated API belonging to the Utils documentation group.

import { AsyncFunction as AsyncFunction_, AsyncMethodsOf as AsyncMethodsOf_, PromiseReturnType as PromiseReturnType_ } from "@bentley/bentleyjs-core";

/** @public @deprecated this type has moved to @bentley/bentleyjs-core */
export type AsyncFunction = AsyncFunction_;

/** @public @deprecated this type has moved to @bentley/bentleyjs-core */
export type AsyncMethodsOf<T> = AsyncMethodsOf_<T>;

/** @public @deprecated this type has moved to @bentley/bentleyjs-core */
export type PromiseReturnType<T extends AsyncFunction_> = PromiseReturnType_<T>;
