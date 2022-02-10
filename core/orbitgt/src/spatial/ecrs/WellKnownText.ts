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

import { AList } from "../../system/collection/AList";
import { ASystem } from "../../system/runtime/ASystem";
import { Message } from "../../system/runtime/Message";
import { Numbers } from "../../system/runtime/Numbers";
import { Strings } from "../../system/runtime/Strings";
import { CRS } from "./CRS";
import { Datum } from "./Datum";
import { Ellipsoid } from "./Ellipsoid";
import { Operation } from "./Operation";
import { OperationMethod } from "./OperationMethod";
import { ParameterValue } from "./ParameterValue";
import { ParameterValueList } from "./ParameterValueList";
import { PrimeMeridian } from "./PrimeMeridian";
import { HotineObliqueMercator } from "./projection/HotineObliqueMercator";
import { KrovakObliqueConformalConic } from "./projection/KrovakObliqueConformalConic";
import { KrovakObliqueConformalConicEN } from "./projection/KrovakObliqueConformalConicEN";
import { LambertConical1SP } from "./projection/LambertConical1SP";
import { LambertConical2SP } from "./projection/LambertConical2SP";
import { Mercator1SP } from "./projection/Mercator1SP";
import { ObliqueMercator } from "./projection/ObliqueMercator";
import { ObliqueStereographic } from "./projection/ObliqueStereographic";
import { TransverseMercator } from "./projection/TransverseMercator";
import { Registry } from "./Registry";
import { PositionVector } from "./transformation/PositionVector";
import { Unit } from "./Unit";
import { WellKnownTextNode } from "./WellKnownTextNode";

/**
 * Class WellKnownText parses Well-known Text Representations of Spatial Reference Systems.
 *
 * @version 1.0 December 2010
 */
/** @internal */
export class WellKnownText {
    /** The name of this module */
    private static readonly MODULE: string = "WellKnownText";

    /** The dialect type in case of generic WKT */
    public static readonly TYPE_GENERIC: string = "generic";

    /** The conversion ratio from "arc-sec" to "radian" */
    private static readonly _ARC_SEC_TO_RAD: float64 = (1.0 / 3600.0 * Math.PI / 180.0);

    /** The counter for creating unique codes */
    private static _CODES: int32 = 100000;

    /**
     * No instances.
     */
    private constructor() { }

    /**
     * Unquote a name.
     * @param name the name.
     * @return the unquoted name.
     */
    private static unquote(name: string): string {
        name = Strings.trim(name);
        ASystem.assert0(Strings.startsWith(name, "\""), "Name '" + name + "' does not start with a quote");
        ASystem.assert0(Strings.endsWith(name, "\""), "Name '" + name + "' does not end with a quote");
        return Strings.substring(name, 1, Strings.getLength(name) - 1);
    }

    /**
     * Get a number.
     * @param value the string value.
     * @return the number.
     */
    private static getInteger(value: string): int32 {
        return Numbers.getInteger(value, 0);
    }

    /**
     * Get a number.
     * @param value the string value.
     * @return the number.
     */
    private static getDouble(value: string): float64 {
        return Numbers.getDouble(value, 0.0);
    }

    /**
     * Get a number.
     * @param value the node value.
     * @return the number.
     */
    private static getNodeDouble(value: WellKnownTextNode): float64 {
        if (value == null) return 0.0;
        return Numbers.getDouble(value.getName(), 0.0);
    }

    /**
     * Get an EPSG code for an element.
     * @param authority the authority for the element.
     * @param dialect the dialect of WKT to parse.
     * @return the EPSG code (zero if not found).
     */
    private static getEPSGCode(authority: WellKnownTextNode, dialect: string): int32 {
        // example: AUTHORITY["EPSG","2320"]
        if (authority == null) return 0;
        let name: string = WellKnownText.unquote(authority.getArgument(0).getName());
        let code: string = WellKnownText.unquote(authority.getArgument(1).getName());
        if (Strings.equalsIgnoreCase(name, "EPSG") == false) return 0;
        let epsgCode: int32 = Numbers.getInteger(code, 0);
        return epsgCode; // Enabled on 06/06/2014
    }

    /**
     * Parse a linear unit.
     * @param node the well-known-text node.
     * @param dialect the dialect of WKT to parse.
     * @return the unit.
     */
    private static parseLinearUnit(node: WellKnownTextNode, dialect: string): Unit {
        /* Get the parameters */
        let name: string = WellKnownText.unquote(node.getArgument(0).getName());
        let conversionFactor: float64 = WellKnownText.getDouble(node.getArgument(1).getName());
        let authority: WellKnownTextNode = node.getArgumentByName("AUTHORITY");
        /* Do we have an EPGS code ? */
        let epsgCode: int32 = WellKnownText.getEPSGCode(authority, dialect);
        let code: int32 = (epsgCode == 0) ? WellKnownText._CODES++ : epsgCode;
        /* Return the unit */
        return new Unit(code, name, name/*abbreviation*/, "length", Unit.METER/*targetUnitCode*/, conversionFactor, 1.0);
    }

    /**
     * Parse an angular unit.
     * @param node the well-known-text node.
     * @param dialect the dialect of WKT to parse.
     * @return the unit.
     */
    private static parseAngularUnit(node: WellKnownTextNode, dialect: string): Unit {
        /* Get the parameters */
        let name: string = WellKnownText.unquote(node.getArgument(0).getName());
        let conversionFactor: float64 = WellKnownText.getDouble(node.getArgument(1).getName());
        let authority: WellKnownTextNode = node.getArgumentByName("AUTHORITY");
        /* Do we have an EPGS code ? */
        let epsgCode: int32 = WellKnownText.getEPSGCode(authority, dialect);
        let code: int32 = (epsgCode == 0) ? WellKnownText._CODES++ : epsgCode;
        /* Return the unit */
        return new Unit(code, name, name/*abbreviation*/, "angle", Unit.RADIAN/*targetUnitCode*/, conversionFactor, 1.0);
    }

    /**
     * Parse a spheroid.
     * @param crsCode the code of the CRS.
     * @param node the well-known-text node.
     * @param dialect the dialect of WKT to parse.
     * @return the ellipsoid.
     */
    private static parseSpheroid(crsCode: int32, node: WellKnownTextNode, dialect: string): Ellipsoid {
        /* Get the parameters */
        let name: string = WellKnownText.unquote(node.getArgument(0).getName());
        let semiMajorAxis: float64 = WellKnownText.getDouble(node.getArgument(1).getName());
        let invFlattening: float64 = WellKnownText.getDouble(node.getArgument(2).getName());
        let authority: WellKnownTextNode = node.getArgumentByName("AUTHORITY");
        /* Do we have an EPGS code ? */
        let epsgCode: int32 = WellKnownText.getEPSGCode(authority, dialect);
        let code: int32 = (epsgCode == 0) ? WellKnownText._CODES++ : epsgCode;
        /* Return the ellipsoid */
        return new Ellipsoid(code, name, Unit.METER, semiMajorAxis, invFlattening, 0.0);
    }

    /**
     * Parse a prime-meridian.
     * @param crsCode the code of the CRS.
     * @param node the well-known-text node.
     * @param dialect the dialect of WKT to parse.
     * @return the prime-meridian.
     */
    private static parsePrimeMeridian(crsCode: int32, node: WellKnownTextNode, dialect: string): PrimeMeridian {
        /* Get the parameters */
        let name: string = WellKnownText.unquote(node.getArgument(0).getName());
        let longitude: float64 = WellKnownText.getDouble(node.getArgument(1).getName());
        let authority: WellKnownTextNode = node.getArgumentByName("AUTHORITY");
        /* Do we have an EPGS code ? */
        let epsgCode: int32 = WellKnownText.getEPSGCode(authority, dialect);
        let code: int32 = (epsgCode == 0) ? WellKnownText._CODES++ : epsgCode;
        /* Return the prime-meridian */
        return new PrimeMeridian(code, name, longitude/*lonFromGreenwich*/, Unit.DEGREE/*?*/);
    }

    /**
     * Parse a to-wgs84 transform.
     * @param node the well-known-text node (method position vector).
     * @param dialect the dialect of WKT to parse.
     * @return the transform.
     */
    public static parseToWGS84(node: WellKnownTextNode, dialect: string): OperationMethod {
        /* No transform ? */
        if (node == null) return null;
        /* Get the parameters */
        let dx: float64 = WellKnownText.getNodeDouble(node.getArgument(0)); // meter
        let dy: float64 = WellKnownText.getNodeDouble(node.getArgument(1));
        let dz: float64 = WellKnownText.getNodeDouble(node.getArgument(2));
        let rx: float64 = WellKnownText.getNodeDouble(node.getOptionalArgument(3)); // arc-second
        let ry: float64 = WellKnownText.getNodeDouble(node.getOptionalArgument(4));
        let rz: float64 = WellKnownText.getNodeDouble(node.getOptionalArgument(5));
        let ppm: float64 = WellKnownText.getNodeDouble(node.getOptionalArgument(6)); // parts-per-million
        /* Return the transform */
        return PositionVector.create(dx, dy, dz, rx * WellKnownText._ARC_SEC_TO_RAD, ry * WellKnownText._ARC_SEC_TO_RAD, rz * WellKnownText._ARC_SEC_TO_RAD, ppm / 1.0e6);
    }

    /**
     * Parse a datum.
     * @param crsCode the code of the CRS.
     * @param node the well-known-text node.
     * @param primeMeridian the prime meridian.
     * @param dialect the dialect of WKT to parse.
     * @return the datum (with optional embedded datum transformation to WGS84).
     */
    private static parseDatum(crsCode: int32, node: WellKnownTextNode, primeMeridian: PrimeMeridian, dialect: string): Datum {
        /* Get the parameters */
        let name: string = WellKnownText.unquote(node.getArgument(0).getName());
        let spheroid: Ellipsoid = WellKnownText.parseSpheroid(crsCode, node.getArgumentByName("SPHEROID"), dialect);
        let toWGS84: OperationMethod = WellKnownText.parseToWGS84(node.getArgumentByName("TOWGS84"), dialect);
        if (toWGS84 == null) toWGS84 = PositionVector.create(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0); // default (identity) transform added on 19/06/2013 to allow ViewTransform creation.
        let authority: WellKnownTextNode = node.getArgumentByName("AUTHORITY");
        /* Do we have an EPGS code ? */
        let epsgCode: int32 = WellKnownText.getEPSGCode(authority, dialect);
        let code: int32 = (epsgCode == 0) ? WellKnownText._CODES++ : epsgCode;
        /* Return the datum */
        let datum: Datum = new Datum(code, name, Datum.TYPE_GEODETIC, spheroid, primeMeridian);
        datum.setToWGS84(toWGS84);
        return datum;
    }

    /**
     * Parse a projection method.
     * @param projection the well-known-text projection node.
     * @param parameters the well-known-text parameter nodes.
     * @param dialect the dialect of WKT to parse.
     * @return the projection method.
     */
    private static parseProjectionMethod(projection: WellKnownTextNode, parameters: AList<WellKnownTextNode>, dialect: string): OperationMethod {
        // See: http://www.remotesensing.org/geotiff/proj_list/
        // for method names and parameter names and units
        //
        /* Get the projection name */
        let projectionName: string = WellKnownText.unquote(projection.getArgument(0).getName());
        /* Get the standard units */
        let DEG: Unit = Registry.getUnit(Unit.DEGREE);
        let METER: Unit = Registry.getUnit(Unit.METER);
        let SCALE: Unit = Registry.getUnit(Unit.UNITY);
        /* Convert to standard parameters */
        let parameterList: ParameterValueList = new ParameterValueList();
        for (let i: number = 0; i < parameters.size(); i++) {
            /* Get the parameter name and value */
            let parameter: WellKnownTextNode = parameters.get(i);
            let parameterName: string = WellKnownText.unquote(parameter.getArgument(0).getName());
            let parameterValue: float64 = WellKnownText.getDouble(parameter.getArgument(1).getName());
            /* Hotine_Oblique_Mercator */
            if (Strings.equalsIgnoreCase(projectionName, "Hotine_Oblique_Mercator")) {
                if (Strings.equalsIgnoreCase(parameterName, "latitude_of_center")) parameterList.add(new ParameterValue(8811, parameterValue, DEG));
                if (Strings.equalsIgnoreCase(parameterName, "longitude_of_center")) parameterList.add(new ParameterValue(8812, parameterValue, DEG));
                if (Strings.equalsIgnoreCase(parameterName, "azimuth")) parameterList.add(new ParameterValue(8813, parameterValue, DEG));
                if (Strings.equalsIgnoreCase(parameterName, "rectified_grid_angle")) parameterList.add(new ParameterValue(8814, parameterValue, DEG));
                if (Strings.equalsIgnoreCase(parameterName, "scale_factor")) parameterList.add(new ParameterValue(8815, parameterValue, SCALE));
                if (Strings.equalsIgnoreCase(parameterName, "false_easting")) parameterList.add(new ParameterValue(8806, parameterValue, METER));
                if (Strings.equalsIgnoreCase(parameterName, "false_northing")) parameterList.add(new ParameterValue(8807, parameterValue, METER));
            }
            /* Krovak */
            if (Strings.equalsIgnoreCase(projectionName, "Krovak") || Strings.equalsIgnoreCase(projectionName, "KrovakEN")) {
                if (Strings.equalsIgnoreCase(parameterName, "latitude_of_center")) parameterList.add(new ParameterValue(8811, parameterValue, DEG));
                if (Strings.equalsIgnoreCase(parameterName, "longitude_of_center")) parameterList.add(new ParameterValue(8833, parameterValue, DEG));
                if (Strings.equalsIgnoreCase(parameterName, "azimuth")) parameterList.add(new ParameterValue(1036, parameterValue, DEG)); // changed from 8813 to 1036 on 31/08/2017
                if (Strings.equalsIgnoreCase(parameterName, "pseudo_standard_parallel_1")) parameterList.add(new ParameterValue(8818, parameterValue, DEG));
                if (Strings.equalsIgnoreCase(parameterName, "scale_factor")) parameterList.add(new ParameterValue(8819, parameterValue, SCALE));
                if (Strings.equalsIgnoreCase(parameterName, "false_easting")) parameterList.add(new ParameterValue(8806, parameterValue, METER));
                if (Strings.equalsIgnoreCase(parameterName, "false_northing")) parameterList.add(new ParameterValue(8807, parameterValue, METER));
            }
            /* Lambert_Conformal_Conic_1SP */
            if (Strings.equalsIgnoreCase(projectionName, "Lambert_Conformal_Conic_1SP")) {
                if (Strings.equalsIgnoreCase(parameterName, "latitude_of_origin")) parameterList.add(new ParameterValue(8801, parameterValue, DEG));
                if (Strings.equalsIgnoreCase(parameterName, "central_meridian")) parameterList.add(new ParameterValue(8802, parameterValue, DEG));
                if (Strings.equalsIgnoreCase(parameterName, "scale_factor")) parameterList.add(new ParameterValue(8805, parameterValue, SCALE));
                if (Strings.equalsIgnoreCase(parameterName, "false_easting")) parameterList.add(new ParameterValue(8806, parameterValue, METER));
                if (Strings.equalsIgnoreCase(parameterName, "false_northing")) parameterList.add(new ParameterValue(8807, parameterValue, METER));
            }
            /* Lambert_Conformal_Conic_2SP / Lambert_Conformal_Conic_2SP_Belgium / Lambert_Conformal_Conic  */
            if (Strings.equalsIgnoreCase(projectionName, "Lambert_Conformal_Conic_2SP") || Strings.equalsIgnoreCase(projectionName, "Lambert_Conformal_Conic_2SP_Belgium") || Strings.equalsIgnoreCase(projectionName, "Lambert_Conformal_Conic")) {
                if (Strings.equalsIgnoreCase(parameterName, "latitude_of_origin")) parameterList.add(new ParameterValue(8821, parameterValue, DEG));
                if (Strings.equalsIgnoreCase(parameterName, "central_meridian")) parameterList.add(new ParameterValue(8822, parameterValue, DEG));
                if (Strings.equalsIgnoreCase(parameterName, "standard_parallel_1")) parameterList.add(new ParameterValue(8823, parameterValue, DEG));
                if (Strings.equalsIgnoreCase(parameterName, "standard_parallel_2")) parameterList.add(new ParameterValue(8824, parameterValue, DEG));
                if (Strings.equalsIgnoreCase(parameterName, "false_easting")) parameterList.add(new ParameterValue(8826, parameterValue, METER));
                if (Strings.equalsIgnoreCase(parameterName, "false_northing")) parameterList.add(new ParameterValue(8827, parameterValue, METER));
                //                if (Strings.equalsIgnoreCase(parameterName,"scale_factor")) {if (parameterValue!=1.0) throw new IllegalArgumentException(MODULE+" : Invalid parameter '"+parameterName+"' with value "+parameterValue);}
            }
            /* Mercator_1SP */
            if (Strings.equalsIgnoreCase(projectionName, "Mercator_1SP")) {
                if (Strings.equalsIgnoreCase(parameterName, "latitude_of_origin")) parameterList.add(new ParameterValue(8801, parameterValue, DEG));
                if (Strings.equalsIgnoreCase(parameterName, "central_meridian")) parameterList.add(new ParameterValue(8802, parameterValue, DEG));
                if (Strings.equalsIgnoreCase(parameterName, "scale_factor")) parameterList.add(new ParameterValue(8805, parameterValue, SCALE));
                if (Strings.equalsIgnoreCase(parameterName, "false_easting")) parameterList.add(new ParameterValue(8806, parameterValue, METER));
                if (Strings.equalsIgnoreCase(parameterName, "false_northing")) parameterList.add(new ParameterValue(8807, parameterValue, METER));
            }
            /* Oblique_Mercator */
            if (Strings.equalsIgnoreCase(projectionName, "Oblique_Mercator")) {
                if (Strings.equalsIgnoreCase(parameterName, "latitude_of_center")) parameterList.add(new ParameterValue(8811, parameterValue, DEG));
                if (Strings.equalsIgnoreCase(parameterName, "longitude_of_center")) parameterList.add(new ParameterValue(8812, parameterValue, DEG));
                if (Strings.equalsIgnoreCase(parameterName, "azimuth")) parameterList.add(new ParameterValue(8813, parameterValue, DEG));
                if (Strings.equalsIgnoreCase(parameterName, "rectified_grid_angle")) parameterList.add(new ParameterValue(8814, parameterValue, DEG));
                if (Strings.equalsIgnoreCase(parameterName, "scale_factor")) parameterList.add(new ParameterValue(8815, parameterValue, SCALE));
                if (Strings.equalsIgnoreCase(parameterName, "false_easting")) parameterList.add(new ParameterValue(8816, parameterValue, METER));
                if (Strings.equalsIgnoreCase(parameterName, "false_northing")) parameterList.add(new ParameterValue(8817, parameterValue, METER));
            }
            /* Oblique_Stereographic /Transverse_Mercator */
            if (Strings.equalsIgnoreCase(projectionName, "Oblique_Stereographic") || Strings.equalsIgnoreCase(projectionName, "Transverse_Mercator")) {
                if (Strings.equalsIgnoreCase(parameterName, "latitude_of_origin")) parameterList.add(new ParameterValue(8801, parameterValue, DEG));
                if (Strings.equalsIgnoreCase(parameterName, "central_meridian")) parameterList.add(new ParameterValue(8802, parameterValue, DEG));
                if (Strings.equalsIgnoreCase(parameterName, "scale_factor")) parameterList.add(new ParameterValue(8805, parameterValue, SCALE));
                if (Strings.equalsIgnoreCase(parameterName, "false_easting")) parameterList.add(new ParameterValue(8806, parameterValue, METER));
                if (Strings.equalsIgnoreCase(parameterName, "false_northing")) parameterList.add(new ParameterValue(8807, parameterValue, METER));
            }
        }
        /* Create the right method */
        if (Strings.equalsIgnoreCase(projectionName, "Hotine_Oblique_Mercator")) return new HotineObliqueMercator(parameterList);
        if (Strings.equalsIgnoreCase(projectionName, "Krovak")) return new KrovakObliqueConformalConic(parameterList);
        if (Strings.equalsIgnoreCase(projectionName, "KrovakEN")) return new KrovakObliqueConformalConicEN(parameterList);
        if (Strings.equalsIgnoreCase(projectionName, "Lambert_Conformal_Conic_1SP")) return new LambertConical1SP(parameterList);
        if (Strings.equalsIgnoreCase(projectionName, "Lambert_Conformal_Conic_2SP")) return new LambertConical2SP(parameterList);
        if (Strings.equalsIgnoreCase(projectionName, "Lambert_Conformal_Conic")) return new LambertConical2SP(parameterList);
        if (Strings.equalsIgnoreCase(projectionName, "Mercator_1SP")) return new Mercator1SP(parameterList);
        if (Strings.equalsIgnoreCase(projectionName, "Oblique_Mercator")) return new ObliqueMercator(parameterList);
        if (Strings.equalsIgnoreCase(projectionName, "Oblique_Stereographic")) return new ObliqueStereographic(parameterList);
        if (Strings.equalsIgnoreCase(projectionName, "Transverse_Mercator")) return new TransverseMercator(parameterList);
        ASystem.assert0(false, "Unknown projection type '" + projectionName + "'");
        return null;
    }

    /**
     * Parse a geocentric CRS.
     * @param crsCode the code of the CRS.
     * @param node the well-known-text node.
     * @param dialect the dialect of WKT to parse.
     * @return the CRS.
     */
    private static parseGeocentric(crsCode: int32, node: WellKnownTextNode, dialect: string): CRS {
        /* Get the parameters */
        let name: string = WellKnownText.unquote(node.getArgument(0).getName());
        let primeMeridian: PrimeMeridian = WellKnownText.parsePrimeMeridian(crsCode, node.getArgumentByName("PRIMEM"), dialect);
        let datum: Datum = WellKnownText.parseDatum(crsCode, node.getArgumentByName("DATUM"), primeMeridian, dialect);
        let toWGS84m: OperationMethod = datum.getToWGS84();
        let toWGS84s: AList<Operation> = new AList<Operation>();
        let linearUnit: Unit = WellKnownText.parseLinearUnit(node.getArgumentByName("UNIT"), dialect);
        let axis: AList<WellKnownTextNode> = node.getArgumentsByName("AXIS");
        let authority: WellKnownTextNode = node.getArgumentByName("AUTHORITY");
        /* Do we have an EPGS code ? */
        let epsgCode: int32 = WellKnownText.getEPSGCode(authority, dialect);
        let code: int32 = (epsgCode == 0) ? crsCode : epsgCode;
        /* Return the CRS */
        if (toWGS84m != null) toWGS84s.add(new Operation(0/*code*/, ""/*name*/, Operation.TRANSFORMATION, code, CRS.WGS84_2D_CRS_CODE, 0/*area*/, toWGS84m));
        return new CRS(code, name, 0/*area*/, CRS.GEOCENTRIC, 0/*csCode*/, datum, null/*baseCRS*/, null/*projection*/, toWGS84s);
    }

    /**
     * Parse a geographic CRS.
     * @param crsCode the code of the CRS.
     * @param node the well-known-text node.
     * @param dialect the dialect of WKT to parse.
     * @return the CRS.
     */
    private static parseGeographic(crsCode: int32, node: WellKnownTextNode, dialect: string): CRS {
        /* Get the parameters */
        let name: string = WellKnownText.unquote(node.getArgument(0).getName());
        let primeMeridian: PrimeMeridian = WellKnownText.parsePrimeMeridian(crsCode, node.getArgumentByName("PRIMEM"), dialect);
        let datum: Datum = WellKnownText.parseDatum(crsCode, node.getArgumentByName("DATUM"), primeMeridian, dialect);
        let toWGS84m: OperationMethod = datum.getToWGS84();
        let toWGS84s: AList<Operation> = new AList<Operation>();
        let angularUnit: Unit = WellKnownText.parseAngularUnit(node.getArgumentByName("UNIT"), dialect);
        let axis: AList<WellKnownTextNode> = node.getArgumentsByName("AXIS");
        let authority: WellKnownTextNode = node.getArgumentByName("AUTHORITY");
        /* Do we have an EPGS code ? */
        let epsgCode: int32 = WellKnownText.getEPSGCode(authority, dialect);
        let code: int32 = (epsgCode == 0) ? crsCode : epsgCode;
        /* Return the CRS */
        if (toWGS84m != null) toWGS84s.add(new Operation(0/*code*/, ""/*name*/, Operation.TRANSFORMATION, code, CRS.WGS84_2D_CRS_CODE, 0/*area*/, toWGS84m));
        return new CRS(code, name, 0/*area*/, CRS.GEOGRAPHIC_2D, 0/*csCode*/, datum, null/*baseCRS*/, null/*projection*/, toWGS84s);
    }

    /**
     * Parse a projected CRS.
     * @param crsCode the code of the CRS.
     * @param node the well-known-text node.
     * @param dialect the dialect of WKT to parse.
     * @return the CRS.
     */
    private static parseProjection(crsCode: int32, node: WellKnownTextNode, dialect: string): CRS {
        /* Get the parameters */
        let name: string = WellKnownText.unquote(node.getArgument(0).getName());
        let baseCRS: CRS = WellKnownText.parseGeographic(-crsCode, node.getArgumentByName("GEOGCS"), dialect);
        let projection: WellKnownTextNode = node.getArgumentByName("PROJECTION");
        let parameters: AList<WellKnownTextNode> = node.getArgumentsByName("PARAMETER");
        let projectionMethod: OperationMethod = WellKnownText.parseProjectionMethod(projection, parameters, dialect);
        let linearUnit: Unit = WellKnownText.parseLinearUnit(node.getArgumentByName("UNIT"), dialect);
        let axis: AList<WellKnownTextNode> = node.getArgumentsByName("AXIS");
        let authority: WellKnownTextNode = node.getArgumentByName("AUTHORITY");
        /* Do we have an EPGS code ? */
        let epsgCode: int32 = WellKnownText.getEPSGCode(authority, dialect);
        let code: int32 = (epsgCode == 0) ? crsCode : epsgCode;
        /* Return the CRS */
        let projectionOperation: Operation = new Operation(0/*code*/, ""/*name*/, Operation.CONVERSION, code, baseCRS.getCode(), 0/*area*/, projectionMethod);
        return new CRS(code, name, 0/*area*/, CRS.PROJECTED, 0/*csCode*/, null/*datum*/, baseCRS, projectionOperation, null/*toWGS84*/);
    }

    /**
     * Parse a vertical CRS.
     * @param crsCode the code of the CRS.
     * @param node the well-known-text node.
     * @param dialect the dialect of WKT to parse.
     * @return the CRS.
     */
    private static parseVertical(crsCode: int32, node: WellKnownTextNode, dialect: string): CRS {
        /* Get the parameters */
        let name: string = WellKnownText.unquote(node.getArgument(0).getName());
        let authority: WellKnownTextNode = node.getArgumentByName("AUTHORITY");
        /* Do we have an EPGS code ? */
        let epsgCode: int32 = WellKnownText.getEPSGCode(authority, dialect);
        let code: int32 = (epsgCode == 0) ? crsCode : epsgCode;
        /* Create the datum */
        let datum: Datum = new Datum(code, name, Datum.TYPE_VERTICAL, null/*spheroid*/, null/*primeMeridian*/);
        /* Return the CRS */
        return new CRS(code, name, 0/*area*/, CRS.VERTICAL, 6499/*csCode*/, datum, null/*baseCRS*/, null/*projectionOperation*/, null/*toWGS84*/);
    }

    /**
     * Parse a CRS well-known-text.
     * @param crsCode the code of the CRS.
     * @param text the well-known-text.
     * @param dialect the dialect of WKT to parse.
     * @return the CRS (null if unable to parse).
     */
    public static parseSpatialReferenceSystem(crsCode: int32, text: string, dialect: string): CRS {
        let node: WellKnownTextNode = WellKnownTextNode.parse(text);
        if (Strings.equalsIgnoreCase(node.getName(), "GEOCCS")) return WellKnownText.parseGeocentric(crsCode, node, dialect);
        if (Strings.equalsIgnoreCase(node.getName(), "GEOGCS")) return WellKnownText.parseGeographic(crsCode, node, dialect);
        if (Strings.equalsIgnoreCase(node.getName(), "PROJCS")) return WellKnownText.parseProjection(crsCode, node, dialect);
        if (Strings.equalsIgnoreCase(node.getName(), "VERTCS")) return WellKnownText.parseVertical(crsCode, node, dialect);
        Message.printWarning(WellKnownText.MODULE, "Invalid spatial reference system WKT '" + text + "'");
        return null;
    }
}
