/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayers
 */

/** @beta */
export enum MapLayerAuthType {
  None = 1,
  Basic = 2,
  EsriToken = 3
}
/** @internal */
export interface MapLayerTokenEndpoint {
  getLoginUrl(stateData?: string): string|undefined;
  getUrl(): string;
}

/** @internal */
export interface MapLayerAuthenticationInfo {
  authMethod: MapLayerAuthType;
  tokenEndpoint?: MapLayerTokenEndpoint;
}
