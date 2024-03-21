/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @internal */
export abstract class FeatureSymbology {

}

/** @internal */
export interface FeatureDefaultSymbology {
  getSymbology: (geometryType: string) => FeatureSymbology;
}
