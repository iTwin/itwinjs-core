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
import { Numbers } from "../../system/runtime/Numbers";
import { Strings } from "../../system/runtime/Strings";
import { Coordinate } from "../geom/Coordinate";
import { CRS } from "./CRS";
import { OperationMethod } from "./OperationMethod";
import { Registry } from "./Registry";

/**
 * Class Operation defines an coordinate operation. The operation defines a specific method,
 * together with specific values for the parameters of the method, and a specific source and
 * destination coordinate reference system.
 *
 * 'Conversions' are operations that convert from projected systems to and from geographic systems (same datum).
 * 'Transformations' are Operations that convert from one geocentric system to another (different datum).
 *
 * @version 1.0 July 2005
 */
/** @internal */
export class Operation {
  /** The type of a concatenated operation */
  public static readonly CONCATENATED: int32 = 1;
  /** The type of a conversion operation (projected to geographic) */
  public static readonly CONVERSION: int32 = 2;
  /** The type of a transformation operation (geocentric to geocentric) */
  public static readonly TRANSFORMATION: int32 = 3;

  /** The code */
  private _code: int32;
  /** The name */
  private _name: string;
  /** The type */
  private _type: int32;
  /** The code of the source CRS */
  private _sourceCRScode: int32;
  /** The code of the target CRS */
  private _targetCRScode: int32;
  /** The area on which the operation has been defined (0 if unknown) */
  private _areaOfUse: int32;
  /** The method */
  private _method: OperationMethod;

  /** Have we been initialised ? */
  private _initialised: boolean;
  /** The source coordinate reference system */
  private _sourceCRS: CRS;
  /** The target coordinate reference system */
  private _targetCRS: CRS;
  /** The concatenated operations */
  private _concatenatedOperations: AList<Operation>;

  /**
   * Create a new coordinate operation.
   * @param code the code.
   * @param name the name.
   * @param type the type (CONCATENATED, CONVERSION or TRANSFORMATION).
   * @param sourceCRScode the code of the source CRS.
   * @param targetCRScode the code of the target CRS.
   * @param areaOfUse the area on which the operation has been defined (0 if unknown).
   * @param method the method (null for concatenated operations).
   */
  public constructor(
    code: int32,
    name: string,
    type: int32,
    sourceCRScode: int32,
    targetCRScode: int32,
    areaOfUse: int32,
    method: OperationMethod
  ) {
    /* Store the parameters */
    this._code = code;
    this._name = name;
    this._type = type;
    this._sourceCRScode = sourceCRScode;
    this._targetCRScode = targetCRScode;
    this._areaOfUse = areaOfUse;
    this._method = method;
    /* Clear */
    this._initialised = false;
    this._sourceCRS = null;
    this._targetCRS = null;
    this._concatenatedOperations = null;
  }

  /**
   * Get the code.
   * @return the code.
   */
  public getCode(): int32 {
    return this._code;
  }

  /**
   * Get the name.
   * @return the name.
   */
  public getName(): string {
    return this._name;
  }

  /**
   * Get the type (CONCATENATED, CONVERSION or TRANSFORMATION).
   * @return the type.
   */
  public getType(): int32 {
    return this._type;
  }

  /**
   * Get the code of the source CRS.
   * @return the code of the source CRS.
   */
  public getSourceCRScode(): int32 {
    return this._sourceCRScode;
  }

  /**
   * Get the code of the target CRS.
   * @return the code of the target CRS.
   */
  public getTargetCRScode(): int32 {
    return this._targetCRScode;
  }

  /**
   * Get the area on which the operation has been defined.
   * @return the area on which the operation has been defined (0 if unknown).
   */
  public getAreaOfUse(): int32 {
    return this._areaOfUse;
  }

  /**
   * Get the method (null for concatenated operations).
   * @return the method.
   */
  public getMethod(): OperationMethod {
    return this._method;
  }

  /**
   * Set the method.
   * @param method the new method (null for concatenated operations).
   */
  public setMethod(method: OperationMethod): void {
    this._method = method;
  }

  /**
   * Get the concatenated operations.
   * @return the concatenated operations (null for a method).
   */
  public getConcatenatedOperations(): AList<Operation> {
    return this._concatenatedOperations;
  }

  /**
   * Set the concatenated operations.
   * @param concatenatedOperations the concatenated operations (null for a method).
   */
  public setConcatenatedOperations(
    concatenatedOperations: AList<Operation>
  ): void {
    this._concatenatedOperations = concatenatedOperations;
  }

  /**
   * Initialise the operation.
   */
  public initialise(): void {
    /* Initialize the systems */
    if (this._sourceCRS == null)
      this._sourceCRS = Registry.getCRS(this._sourceCRScode);
    if (this._targetCRS == null)
      this._targetCRS = Registry.getCRS(this._targetCRScode);
    /* Already done ? */
    if (this._initialised) return;
    this._initialised = true;
    /* Concatenated operations ? */
    if (this._type == Operation.CONCATENATED) {
      /* Create the list of operations */
      this._concatenatedOperations = new AList<Operation>(); //Registry.readConcatenatedOperations(this.code);
    } else {
      /* Initialise the method ? */
      this._method.initialize(this);
    }
  }

  /**
   * Get the source CRS.
   * @return the source CRS.
   */
  public getSourceCRS(): CRS {
    if (this._sourceCRS == null) this.initialise();
    return this._sourceCRS;
  }

  /**
   * Set the source CRS.
   * @param sourceCRS the source CRS.
   */
  public setSourceCRS(sourceCRS: CRS): void {
    this._sourceCRS = sourceCRS;
  }

  /**
   * Get the target CRS.
   * @return the target CRS.
   */
  public getTargetCRS(): CRS {
    if (this._targetCRS == null) this.initialise();
    return this._targetCRS;
  }

  /**
   * Set the target CRS.
   * @param targetCRS the target CRS.
   */
  public setTargetCRS(targetCRS: CRS): void {
    this._targetCRS = targetCRS;
  }

  /**
   * Convert a source coordinate to a target coordinate.
   * @param source the coordinates in the source CRS.
   * @param target the coordinates in the target CRS (this is the result object).
   */
  public forward(source: Coordinate, target: Coordinate): void {
    this.initialise();
    /* Concatenated operations ? */
    if (this._type == Operation.CONCATENATED) {
      /* Run all operations */
      for (let i: number = 0; i < this._concatenatedOperations.size(); i++) {
        this._concatenatedOperations.get(i).forward(source, target);
        source = target;
      }
    } else {
      /* Let the method do it */
      this._method.forward(this._sourceCRS, source, this._targetCRS, target);
    }
  }

  /**
   * Convert a target coordinate to a source coordinate.
   * @param source the coordinates in the source CRS (this is the result object).
   * @param target the coordinates in the target CRS.
   */
  public reverse(source: Coordinate, target: Coordinate): void {
    this.initialise();
    /* Concatenated operations ? */
    if (this._type == Operation.CONCATENATED) {
      /* Run all operations */
      for (let i: number = 0; i < this._concatenatedOperations.size(); i++) {
        this._concatenatedOperations
          .get(this._concatenatedOperations.size() - 1 - i)
          .reverse(source, target);
        target = source;
      }
    } else {
      /* Let the method do it */
      this._method.reverse(this._sourceCRS, source, this._targetCRS, target);
    }
  }

  /**
   * Check if another operation is compatible with this one.
   * @param other the other operation.
   * @return true if compatible.
   */
  public isCompatible(other: Operation): boolean {
    if (other._code == this._code) return true; // all operations should have unique identifiers
    if (other._type != this._type) return false;
    if (other._sourceCRScode != this._sourceCRScode) return false;
    if (other._targetCRScode != this._targetCRScode) return false;
    if (other._method.isCompatible(this._method) == false) return false;
    if (
      Operation.areCompatibleOperations(
        other._concatenatedOperations,
        this._concatenatedOperations
      ) == false
    )
      return false;
    return true;
  }

  /**
   * Check if two operations are compatible.
   * @param operation1 the first operation.
   * @param operation2 the second operation.
   * @return true if compatible.
   */
  public static isCompatibleOperation(
    operation1: Operation,
    operation2: Operation
  ): boolean {
    if (operation1 == null) return operation2 == null;
    if (operation2 == null) return false;
    return operation1.isCompatible(operation2);
  }

  /**
   * Check if a list of operations is compatible with another one.
   * @param list1 the first list.
   * @param list2 the second list.
   * @return true if compatible.
   */
  private static areCompatibleOperations(
    list1: AList<Operation>,
    list2: AList<Operation>
  ): boolean {
    if (list1 == null) return list2 == null;
    if (list2 == null) return false;
    if (list2.size() != list1.size()) return false;
    for (let i: number = 0; i < list2.size(); i++)
      if (list2.get(i).isCompatible(list1.get(i)) == false) return false;
    return true;
  }

  /**
   * The standard toString method.
   * @see Object#toString
   */
  public toString(): string {
    return (
      "[Operation:code=" +
      this._code +
      ",name='" +
      this._name +
      "',type=" +
      this._type +
      ",sourceCRS=" +
      this._sourceCRScode +
      ",targetCRS=" +
      this._targetCRScode +
      ",area=" +
      this._areaOfUse +
      ",method=" +
      this._method +
      "]"
    );
  }

  /**
   * Find an operation by name.
   * @param operations the list of operations.
   * @param name the name of the operation.
   * @return the index of the operation.
   */
  public static findByName(operations: Array<Operation>, name: string): int32 {
    /* No list ? */
    if (operations == null) return -1;
    /* Check */
    for (let i: number = 0; i < operations.length; i++)
      if (Strings.equalsIgnoreCase(operations[i].getName(), name)) return i;
    /* Not found */
    return -1;
  }

  /**
   * Get the version of a transformation.
   * @param transformationName the name of the transformation.
   * @return the version (0 if not found).
   */
  private static getTransformationVersion(transformationName: string): int32 {
    /* Find the (...) sequence */
    let index0: int32 = Strings.lastIndexOf(transformationName, "(");
    if (index0 < 0) return 0;
    let index1: int32 = Strings.lastIndexOf(transformationName, ")");
    if (index1 < 0 || index1 < index0) return 0;
    /* Parse the version */
    let version: string = Strings.substring(
      transformationName,
      index0 + 1,
      index1
    );
    return Numbers.getInteger(version, 0);
  }

  /**
   * Get the latest transform from a set of transformations.
   * @param transformations the set of transformations.
   * @return the latest transform.
   */
  public static getLatestTransformation(
    transformations: AList<Operation>
  ): Operation {
    /* We need at least two transforms */
    if (transformations == null) return null;
    if (transformations.size() == 0) return null;
    if (transformations.size() == 1) return transformations.get(0);
    /* Start with the first transform */
    let bestIndex: int32 = 0;
    let bestVersion: int32 = Operation.getTransformationVersion(
      transformations.get(bestIndex).getName()
    );
    /* Check for better versions */
    for (let i: number = 1; i < transformations.size(); i++) {
      /* Check */
      let version: int32 = Operation.getTransformationVersion(
        transformations.get(i).getName()
      );
      if (version > bestVersion) {
        /* This one is later */
        bestIndex = i;
        bestVersion = version;
      }
    }
    /* Return the best transform */
    return transformations.get(bestIndex);
  }
}
