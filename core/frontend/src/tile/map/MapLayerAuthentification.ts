/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

/** @beta */
export enum MapLayerAuthType {
  None = 1,
  Basic = 2,
  EsriToken = 3,
  EsriOAuth2 = 4,
}
/** @internal */
export interface MapLayerTokenEndpoint {
  getTokenGenerationUrl(stateData?: string): string|undefined;
}

/** @internal */
export interface MapLayerAuthentificationInfo {
  authMethod: MapLayerAuthType;
  tokenEndpoint?: MapLayerTokenEndpoint;
}
