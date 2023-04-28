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
import { StringMap } from "../../system/collection/StringMap";
import { ASystem } from "../../system/runtime/ASystem";
import { Numbers } from "../../system/runtime/Numbers";
import { Strings } from "../../system/runtime/Strings";
import { CRS } from "./CRS";
import { DataFileUnit } from "./DataFileUnit";
import { Operation } from "./Operation";
import { Unit } from "./Unit";

/**
 * Class Registry defines the EPSG registry of coordinate reference systems (CRS).
 *
 * @version 1.0 December 2019
 */
/** @internal */
export class Registry {
  /** The name of the unit table */
  private static readonly _TABLE_UNIT: string = "unit";

  // Unit columns: UOM_CODE	UNIT_OF_MEAS_NAME	UNIT_OF_MEAS_TYPE	TARGET_UOM_CODE	FACTOR_B	FACTOR_C	ABBREVIATION
  private static readonly _COL_COUNT_UNIT: int32 = 7;
  private static readonly _COL_UNIT_CODE: int32 = 0;
  private static readonly _COL_UNIT_NAME: int32 = 1;
  private static readonly _COL_UNIT_TYPE: int32 = 2;
  private static readonly _COL_UNIT_TARGET_CODE: int32 = 3;
  private static readonly _COL_UNIT_FACTOR_B: int32 = 4;
  private static readonly _COL_UNIT_FACTOR_C: int32 = 5;
  private static readonly _COL_UNIT_ABBREVIATION: int32 = 6;

  /** The map for preferred transformation between CRSs */
  private static _PREFERRED_TRANSFORMATIONS: StringMap<Operation> = new StringMap<Operation>();
  /** Define the list of all units */
  private static _UNIT_LIST: AList<Unit> = null;
  /** Define the map of CRS instances that have been read */
  private static _CRS_MAP: StringMap<CRS> = new StringMap<CRS>();

  /**
   * No instances.
   */
  private constructor() {}

  /**
   * Get the UTM CRS code at a certain location.
   * @param lon the WGS84 (CRS 4326) longitude (degrees).
   * @param lat the WGS84 (CRS 4326) latitude (degrees).
   * @return the CRS code.
   */
  public static getUTMCRSCodeAt(lon: float64, lat: float64): int32 {
    /* Normalize longitude */
    while (lon < -180.0) lon += 360.0;
    while (lon > 180.0) lon -= 360.0;
    /* Get the zone identifier */
    let zoneId: int32 = Math.round((lon + 183.0) / 6.0);
    if (zoneId < 1) zoneId = 1;
    if (zoneId > 60) zoneId = 60;
    /* Get the CRS code */
    return lat >= 0.0 ? 32600 + zoneId : 32700 + zoneId;
  }

  /**
   * Get a preferred transformation (to WGS84).
   * @param crs the crs.
   * @return the preferred transformation (can be null).
   */
  public static getPreferredTransformation(crs: string): Operation {
    return Registry._PREFERRED_TRANSFORMATIONS.get(crs);
  }

  /**
   * Set a preferred transformation (to WGS84).
   * @param crs the crs.
   * @param transformation the preferred transformation (can be null).
   */
  public static setPreferredTransformation(crs: string, transformation: Operation): void {
    Registry._PREFERRED_TRANSFORMATIONS.put(crs, transformation);
  }

  /**
   * Open a table.
   * @param tableName the name of the table.
   * @return the table.
   */
  private static openTable(tableName: string): AList<string> {
    if (Strings.equals(tableName, Registry._TABLE_UNIT)) return DataFileUnit.getDataLines();
    return new AList<string>();
  }

  /**
   * Read all units.
   * @return all units.
   */
  private static readAllUnits(): AList<Unit> {
    /* Make the list */
    let units: AList<Unit> = new AList<Unit>();
    /* Open the table */
    let tableReader: AList<string> = Registry.openTable(Registry._TABLE_UNIT);
    let headerLine: string = tableReader.get(0);
    /* Process the table */
    for (let i: number = 1; i < tableReader.size(); i++) {
      /* Read the next line */
      let line: string = tableReader.get(i);
      /* Get the columns */
      let parts: AList<string> = Strings.splitAsList(line, Strings.TAB);
      if (parts.size() != Registry._COL_COUNT_UNIT) continue;
      /* Get the parameters */
      let code: int32 = Numbers.getInteger(parts.get(Registry._COL_UNIT_CODE), 0);
      let name: string = parts.get(Registry._COL_UNIT_NAME);
      let type: string = parts.get(Registry._COL_UNIT_TYPE);
      let targetUnitCode: int32 = Numbers.getInteger(parts.get(Registry._COL_UNIT_TARGET_CODE), 0);
      let b: float64 = Numbers.getDouble(parts.get(Registry._COL_UNIT_FACTOR_B), 0.0);
      let c: float64 = Numbers.getDouble(parts.get(Registry._COL_UNIT_FACTOR_C), 0.0);
      let abbreviation: string = parts.get(Registry._COL_UNIT_ABBREVIATION);
      /* Add a new unit */
      let unit: Unit = new Unit(code, name, abbreviation, type, targetUnitCode, b, c);
      units.add(unit);
    }
    /* Return the units */
    return units;
  }

  /**
   * List all units.
   * @return all units.
   */
  public static listUnits(): AList<Unit> {
    if (Registry._UNIT_LIST == null) Registry._UNIT_LIST = Registry.readAllUnits();
    return Registry._UNIT_LIST;
  }

  /**
   * Find a unit.
   * @param unitCode the identification code of the unit.
   * @return a unit (null if not found).
   */
  public static findUnit(unitCode: int32): Unit {
    let unitList: AList<Unit> = Registry.listUnits();
    for (let unit of unitList) if (unit.getCode() == unitCode) return unit;
    return null;
  }

  /**
   * Get a unit.
   * @param unitCode the identification code of the unit.
   * @return a unit (not null).
   */
  public static getUnit(unitCode: int32): Unit {
    let unit: Unit = Registry.findUnit(unitCode);
    ASystem.assertNot(unit == null, "Unit '" + unitCode + "' not found");
    return unit;
  }

  /**
   * Find a unit by name.
   * @param unitName the name (or abbreviation or code) of the unit.
   * @return a unit (null if not found).
   */
  public static findUnitName(unitName: string): Unit {
    if (unitName == null) return null;
    let unitList: AList<Unit> = Registry.listUnits();
    for (let unit of unitList) if (Strings.equalsIgnoreCase(unitName, unit.getName())) return unit;
    for (let unit of unitList) if (Strings.equalsIgnoreCase(unitName, unit.getAbbreviation())) return unit;
    for (let unit of unitList) if (Strings.equals(unitName, "" + unit.getCode())) return unit;
    return null;
  }

  /**
   * Get a CRS.
   * @param crsCode the identification code of the CRS.
   * @return the CRS (null if not found).
   */
  public static getCRS(crsCode: int32): CRS {
    return Registry._CRS_MAP.get("" + crsCode);
  }

  /**
   * Get a CRS.
   * @param crsCode the identification code of the CRS.
   * @return the CRS (null if not found).
   */
  public static getCRS2(crsCode: string): CRS {
    return Registry._CRS_MAP.get(crsCode);
  }

  /**
   * Set a CRS.
   * @param crsCode the identification code of the CRS.
   * @param the CRS.
   */
  public static setCRS(crsCode: int32, crs: CRS): void {
    /* Register the CRS */
    Registry._CRS_MAP.set("" + crsCode, crs);
    /* Register the base CRS as well */
    let baseCRS: CRS = crs.getBaseCRS();
    if (baseCRS != null) Registry.setCRS(baseCRS.getCode(), baseCRS);
  }
}
