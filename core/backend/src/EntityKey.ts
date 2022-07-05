/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { Id64String } from "@itwin/core-bentley";
import type { Entity } from "./Entity";
import { Element } from "./Element";

/** Elements and non-element entities have different id sequences, they can collide with each other, but not within themselves
 * This key format can be used for storing a unique key for an entity in containers like `Map`
 * @internal
 */
export type EntityKey = `e${Id64String}` | `n${Id64String}`;

// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace EntityKey {
  export function from(entity: Entity): EntityKey {
    return `${entity instanceof Element ? "e" : "n"}:${entity.id}`;
  }
}
