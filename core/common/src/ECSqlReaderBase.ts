/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Base64EncodedString } from "./Base64EncodedString";
import { QueryPropertyMetaData, QueryRowFormat } from "./ConcurrentQuery";

/** @public */
export class PropertyMetaDataMap implements Iterable<QueryPropertyMetaData> {
  private _byPropName = new Map<string, number>();
  private _byJsonName = new Map<string, number>();
  private _byNoCase = new Map<string, number>();

  public constructor(public readonly properties: QueryPropertyMetaData[]) {
    for (const property of this.properties) {
      property.extendType = property.extendedType !== undefined ? property.extendedType : "";   // eslint-disable-line @typescript-eslint/no-deprecated
      property.extendedType = property.extendedType === "" ? undefined : property.extendedType;
      this._byPropName.set(property.name, property.index);
      this._byJsonName.set(property.jsonName, property.index);
      this._byNoCase.set(property.name.toLowerCase(), property.index);
      this._byNoCase.set(property.jsonName.toLowerCase(), property.index);
    }
  }

  public get length(): number {
    return this.properties.length;
  }

  public [Symbol.iterator](): Iterator<QueryPropertyMetaData, any, undefined> {
    return this.properties[Symbol.iterator]();
  }

  public findByName(name: string): QueryPropertyMetaData | undefined {
    const index = this._byPropName.get(name);
    if (typeof index === "number") {
      return this.properties[index];
    }
    return undefined;
  }

  public findByJsonName(name: string): QueryPropertyMetaData | undefined {
    const index = this._byJsonName.get(name);
    if (typeof index === "number") {
      return this.properties[index];
    }
    return undefined;
  }

  public findByNoCase(name: string): QueryPropertyMetaData | undefined {
    const index = this._byNoCase.get(name.toLowerCase());
    if (typeof index === "number") {
      return this.properties[index];
    }
    return undefined;
  }
}

/**
 * The format for rows returned by [[ECSqlReader]].
 * @public
 */
export type QueryValueType = any;

/**
 * Methods and ways of accessing values from rows returned by [[ECSqlReader]].
 * @public
 */
export interface QueryRowProxy {
  /**
   * Get the current row as a JavaScript `object`.
   *
   * @returns The current row as a JavaScript `object`.
   */
  toRow(): any;

  /**
   * Get all remaining rows from the query result.
   * If called on the current row ([[ECSqlReader.current]]), only that row is returned.
   *
   * @returns All remaining rows from the query result.
   */
  toArray(): QueryValueType[];

  /**
   * Get the metadata for each column in the query result.
   *
   * @returns The metadata for each column in the query result.
   */
  getMetaData(): QueryPropertyMetaData[];

  /**
   * Access a property using its name.
   *
   * @returns The value from the row whose key (ECSQL column name) is `propertyName`.
   *
   * @example
   * The following lines will all return the same result:
   * ```ts
   * reader.current.ECInstanceId;
   * reader.current.ecinstanceid;
   * reader.current.["ECInstanceId"];
   * ```
   */
  [propertyName: string]: QueryValueType;

  /**
   * Access a property using its index.
   * The index is relative to the order of the columns returned by the query that produced the row.
   *
   * @returns The value from the column at `propertyIndex`.
   *
   * @example reader.current[0]
   */
  [propertyIndex: number]: QueryValueType;
}

/**
 * Abstract base class providing shared row-proxy access, row formatting, and
 * Base64-to-Uint8Array conversion logic for both the asynchronous [[ECSqlReader]]
 * and the synchronous ECSqlSyncReader.
 *
 * Subclasses must implement [[getRowInternal]] to supply the current row data.
 * @public
 */
export abstract class ECSqlReaderBase {
  /** @internal */
  protected _done: boolean = false;
  /** @internal */
  protected _props = new PropertyMetaDataMap([]);
  /** @internal */
  protected _rowFormat: QueryRowFormat;

  private _rowProxy = new Proxy<ECSqlReaderBase>(this, {
    get: (target: ECSqlReaderBase, key: string | symbol) => {
      if (typeof key === "string") {
        const idx = Number.parseInt(key, 10);
        if (!Number.isNaN(idx)) {
          return target.getRowInternal()[idx];
        }
        const prop = target._props.findByNoCase(key);
        if (prop) {
          return target.getRowInternal()[prop.index];
        }
        if (key === "getMetaData") {
          return () => target._props.properties;
        }
        if (key === "toRow") {
          return () => target.formatCurrentRow(true);
        }
        if (key === "toArray") {
          return () => target.getRowInternal();
        }
      }
      return undefined;
    },
    has: (target: ECSqlReaderBase, p: string | symbol) => {
      return !target._props.findByNoCase(p as string);
    },
    ownKeys: (target: ECSqlReaderBase) => {
      const keys = [];
      for (const prop of target._props) {
        keys.push(prop.name);
      }
      return keys;
    },
  });

  /**
   * @internal
   */
  protected constructor(rowFormat?: QueryRowFormat) {
    this._rowFormat = rowFormat ?? QueryRowFormat.UseECSqlPropertyIndexes;
  }

  /**
   * Get the current row from the query result. The current row is the one most recently stepped-to
   * (by step() or during iteration).
   *
   * Each value from the row can be accessed by index or by name.
   *
   * @see
   * - [[QueryRowFormat]]
   * - [ECSQL Row Formats]($docs/learning/ECSQLRowFormat)
   *
   * @note The current row is a [[QueryRowProxy]] object. To get the row as a basic JavaScript object, call
   *       [[QueryRowProxy.toRow]] on it.
   *
   * @return The current row as a [[QueryRowProxy]].
   */
  public get current(): QueryRowProxy {
    return this._rowProxy as any;
  }

  /**
   * Returns if there are more rows available.
   *
   * @returns `true` if all rows have been stepped through already.<br/>
   *          `false` if there are any yet unaccessed rows.
   */
  public get done(): boolean {
    return this._done;
  }

  /**
   * Returns the raw current row data array. Subclasses implement this to return
   * from their specific storage mechanism.
   * @internal
   */
  protected abstract getRowInternal(): any[];

  /**
   * Converts Base64-encoded strings in a row object into Uint8Arrays in-place.
   * @internal
   */
  protected static replaceBase64WithUint8Array(row: any): void {
    for (const key of Object.keys(row)) {
      const val = row[key];
      if (typeof val === "string") {
        if (Base64EncodedString.hasPrefix(val)) {
          row[key] = Base64EncodedString.toUint8Array(val);
        }
      } else if (typeof val === "object" && val !== null) {
        this.replaceBase64WithUint8Array(val);
      }
    }
  }

  /**
   * Format the current row as a JavaScript object or array depending on the row format.
   * @internal
   */
  protected formatCurrentRow(onlyReturnObject: boolean = false): any[] | object {
    if (!onlyReturnObject && this._rowFormat === QueryRowFormat.UseECSqlPropertyIndexes) {
      return this.getRowInternal();
    }
    const formattedRow = {};
    for (const prop of this._props) {
      const propName = this._rowFormat === QueryRowFormat.UseJsPropertyNames ? prop.jsonName : prop.name;
      const val = this.getRowInternal()[prop.index];
      if (typeof val !== "undefined" && val !== null) {
        Object.defineProperty(formattedRow, propName, {
          value: val,
          enumerable: true,
        });
      }
    }
    return formattedRow;
  }
}