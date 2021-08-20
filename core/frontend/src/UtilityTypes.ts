/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

import { AsyncFunction as AsyncFunction_, AsyncMethodsOf as AsyncMethodsOf_, PromiseReturnType as PromiseReturnType_ } from "@bentley/bentleyjs-core";

/** @public @deprecated this type has moved to @bentley/bentleyjs-core */
export type AsyncFunction = AsyncFunction_;

/** @public @deprecated this type has moved to @bentley/bentleyjs-core */
export type AsyncMethodsOf<T> = AsyncMethodsOf_<T>;

/** @public @deprecated this type has moved to @bentley/bentleyjs-core */
export type PromiseReturnType<T extends AsyncFunction_> = PromiseReturnType_<T>;
