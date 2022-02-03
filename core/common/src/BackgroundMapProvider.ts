/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module DisplayStyles
 */

import type { DeprecatedBackgroundMapProps } from "./BackgroundMapSettings";

/** Enumerates the types of map imagery that can be supplied by a [[BackgroundMapProvider]].
 * @public
 */
export enum BackgroundMapType {
  Street = 1,
  Aerial = 2,
  Hybrid = 3,
}

/** Enumerates a set of supported [[BackgroundMapProvider]]s that can provide map imagery.
 * @note To access imagery from such a provider, an API key must be supplied via [IModelAppOptions.mapLayerOptions]($frontend).
 * @public
 */
export type BackgroundMapProviderName = "BingProvider" | "MapBoxProvider";

/** JSON representation of a [[BackgroundMapProvider]].
 * @see [[BaseMapLayerProps.provider]].
 * @beta
 */
export interface BackgroundMapProviderProps {
  /** The name of the provider. Default: "BingProvider" */
  name?: BackgroundMapProviderName;
  /** The type of imagery to display. Default: Hybrid. */
  type?: BackgroundMapType;
}

/** Describes one of a small set of standard, known suppliers of background map imagery as part of a [[BaseMapLayerSettings]].
 * @beta
 */
export class BackgroundMapProvider {
  /** The name of the provider. */
  public readonly name: BackgroundMapProviderName;
  /** The type of map imagery provided. */
  public readonly type: BackgroundMapType;

  private constructor(name: BackgroundMapProviderName, type: BackgroundMapType) {
    this.name = name;
    this.type = type;
  }

  /** Create a provider from its JSON representation. */
  public static fromJSON(props: BackgroundMapProviderProps): BackgroundMapProvider {
    const name: BackgroundMapProviderName = props.name === "MapBoxProvider" ? props.name : "BingProvider";
    let type;
    switch (props.type) {
      case BackgroundMapType.Street:
      case BackgroundMapType.Aerial:
        type = props.type;
        break;
      default:
        type = BackgroundMapType.Hybrid;
        break;
    }

    return new BackgroundMapProvider(name, type);
  }

  /** Convert this provider to its JSON representation. */
  public toJSON(): BackgroundMapProviderProps {
    return { name: this.name, type: this.type };
  }

  /** @internal */
  public static fromBackgroundMapProps(props: DeprecatedBackgroundMapProps): BackgroundMapProvider {
    // eslint-disable-next-line deprecation/deprecation
    return this.fromJSON({ name: props.providerName as BackgroundMapProviderName, type: props.providerData?.mapType });
  }

  /** Return true if this provider is equivalent to `other`. */
  public equals(other: BackgroundMapProvider): boolean {
    return this.name === other.name && this.type === other.type;
  }
}
