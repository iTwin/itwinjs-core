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

import { CRS } from "./CRS";
import { OnlineRegistry } from "./OnlineRegistry";
import { Registry } from "./Registry";
import { Transform } from "./Transform";

import { CRSEngine } from "../crs/CRSEngine";
import { Bounds } from "../geom/Bounds";
import { Coordinate } from "../geom/Coordinate";
import { Numbers } from "../../system/runtime/Numbers";

/**
 * Class OnlineEngine implements a CRS engine that reads CRS declarations from an online server.
 */
/** @internal */
export class OnlineEngine extends CRSEngine {
    /** The optional online registry */
    private _onlineRegistry: OnlineRegistry;

    /**
     * Create a new online engine.
     * @return the new engine.
     */
    public static async create(): Promise<OnlineEngine> {
        let engine: OnlineEngine = new OnlineEngine();
        await engine.setOnlineRegistry(OnlineRegistry.openOrbitGT());
        return engine;
    }

    /**
     * Create a new engine.
     */
    private constructor() {
        super();
        this._onlineRegistry = null;
    }

    /**
     * Set the online registry to the engine.
     * @param onlineRegistry the registry to add.
     */
    private async setOnlineRegistry(onlineRegistry: OnlineRegistry): Promise<OnlineEngine> {
        this._onlineRegistry = onlineRegistry;
        await this._onlineRegistry.getCRS(4326); // WGS84, lon-lat
        await this._onlineRegistry.getCRS(4978); // WGS84, geocentric
        await this._onlineRegistry.getCRS(3395); // World Mercator
        return this;
    }

    /**
     * CRSEngine method.
     */
    public async prepareForArea(crs: string, area: Bounds): Promise<Bounds> {
        /* Online registry? */
        if (this._onlineRegistry != null) {
            /* Load the CRS */
            let areaCRS: CRS = await this._onlineRegistry.getCRS(Numbers.getInteger(crs, 0));
        }
        /* Download small grid corrections for the area ... */
        /* Return the area */
        return area;
    }

    /**
     * CRSEngine method.
     */
    public transformPoint(point: Coordinate, sourceCRS: string, targetCRS: string): Coordinate {
        let targetPoint: Coordinate = Coordinate.create();
        Transform.transform(sourceCRS, point, targetCRS, targetPoint);
        return targetPoint;
    }

    /**
     * CRSEngine method.
     */
    public isGeocentricCRS(crs: string): boolean {
        let acrs: CRS = Registry.getCRS2(crs);
        if (acrs != null) return acrs.isGeoCentric();
        return false;
    }

    /**
     * CRSEngine method.
     */
    public isGeographicCRS(crs: string): boolean {
        let acrs: CRS = Registry.getCRS2(crs);
        if (acrs != null) return acrs.isGeoGraphic();
        return false;
    }

    /**
     * CRSEngine method.
     */
    public isProjectedCRS(crs: string): boolean {
        let acrs: CRS = Registry.getCRS2(crs);
        if (acrs != null) return acrs.isProjected();
        return false;
    }
}
