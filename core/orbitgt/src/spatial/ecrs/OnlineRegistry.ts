/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.spatial.ecrs;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { Downloader } from "../../system/runtime/Downloader";
import { Message } from "../../system/runtime/Message";
import { Strings } from "../../system/runtime/Strings";
import { CRS } from "./CRS";
import { Registry } from "./Registry";
import { WellKnownText } from "./WellKnownText";

/**
 * Class OnlineRegistry downloads the CRS definitions from an online server.
 *
 * @version 1.0 March 2020
 */
/** @internal */
export class OnlineRegistry {
  /** The name of this module */
  private static readonly MODULE: string = "OnlineRegistry";

  /** The template URL */
  private _urlTemplate: string;
  /** The dialect of WKT to parse */
  private _dialect: string;

  /**
   * Open the OrbitGT online registry, see https://spatialreference.org/.
   * @return the registry.
   */
  public static openOrbitGT(): OnlineRegistry {
    return new OnlineRegistry(
      "https://ogtcrsregistry.blob.core.windows.net/registry/crs/[epsgCode].prj",
      WellKnownText.TYPE_GENERIC
    );
  }

  /**
   * Create a new online registry.
   * @param urlTemplate the template URL in which [epsgCode] will be replaced by the EPSG CRS code.
   * @param dialect the dialect of WKT to parse.
   */
  private constructor(urlTemplate: string, dialect: string) {
    this._urlTemplate = urlTemplate;
    this._dialect = dialect;
  }

  /**
   * Get a CRS.
   * @param epsgCode the EPSG code of the CRS to get.
   * @return the CRS.
   */
  public async getCRS(epsgCode: int32): Promise<CRS> {
    /* Invalid code? */
    if (epsgCode == 0) return null;
    /* Already downloaded? */
    let crs: CRS = Registry.getCRS(epsgCode);
    if (crs != null) return crs;
    /* Download the declaration */
    Message.print(OnlineRegistry.MODULE, "Requesting online crs '" + epsgCode + "'");
    let downloadURL: string = Strings.replace(this._urlTemplate, "[epsgCode]", "" + epsgCode);
    let wkt: string = await Downloader.INSTANCE.downloadText2(downloadURL);
    if (wkt == null) {
      Message.print(OnlineRegistry.MODULE, "No WKT response");
      return null;
    }
    /* Try to parse the WKT */
    crs = WellKnownText.parseSpatialReferenceSystem(epsgCode, wkt, this._dialect);
    if (crs == null) {
      Message.print(OnlineRegistry.MODULE, "The WKT could not be parsed");
      return null;
    }
    crs.setTextForm(wkt);
    /* Keep in memory */
    Message.print(OnlineRegistry.MODULE, "Created online CRS " + crs);
    Registry.setCRS(epsgCode, crs);
    /* Return */
    return crs;
  }
}
