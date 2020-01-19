/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import { Id64String } from "@bentley/bentleyjs-core";

/**
 * Basic reality data model.
 * @alpha
 */
// istanbul ignore next
export class RealityModel {
  constructor(public name: string, public url: string) { }
}

/**
 * Attached reality data model.
 * @alpha
 */
// istanbul ignore next
export class AttachedRealityModel extends RealityModel {
  public id: Id64String;
  public constructor(id: Id64String, name: string, url: string) {
    super(name, url);
    this.id = id;
  }
}

/** Reality Data
 * @alpha
 */
export interface RealityDataEntry {
  model: RealityModel;
  url: string;
  name: string;
  description: string;
  enabled: boolean;
  group: string;
  size: string;
}
