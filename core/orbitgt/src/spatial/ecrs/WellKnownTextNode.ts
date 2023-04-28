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
import { Strings } from "../../system/runtime/Strings";

/**
 * Class WellKnownTextNode defines a node in a well-known-text expression.
 *
 * @version 1.0 December 2010
 */
/** @internal */
export class WellKnownTextNode {
  /** Get the name */
  private _name: string;
  /** Get the arguments */
  private _argumentList: AList<WellKnownTextNode>;

  /**
   * Create a new node.
   * @param name the name.
   * @param argumentList the arguments.
   */
  public constructor(name: string, argumentList: AList<WellKnownTextNode>) {
    if (argumentList == null) argumentList = new AList<WellKnownTextNode>();
    this._name = name;
    this._argumentList = argumentList;
  }

  /**
   * Get the name.
   * @return the name.
   */
  public getName(): string {
    return this._name;
  }

  /**
   * Get the arguments.
   * @return the arguments.
   */
  public getArguments(): AList<WellKnownTextNode> {
    return this._argumentList;
  }

  /**
   * Add an argument.
   * @param argument the argument to add.
   */
  public addArgument(argument: WellKnownTextNode): void {
    this._argumentList.add(argument);
  }

  /**
   * Get an argument.
   * @param index the index of the argument.
   * @return the argument.
   */
  public getArgument(index: int32): WellKnownTextNode {
    return this._argumentList.get(index);
  }

  /**
   * Get an optional argument.
   * @param index the index of the argument.
   * @return the argument.
   */
  public getOptionalArgument(index: int32): WellKnownTextNode {
    if (index < this._argumentList.size()) return this.getArgument(index);
    return null;
  }

  /**
   * Get arguments by name.
   * @param name the name of the arguments.
   * @return the arguments.
   */
  public getArgumentsByName(name: string): AList<WellKnownTextNode> {
    let list: AList<WellKnownTextNode> = new AList<WellKnownTextNode>();
    for (let argument of this._argumentList) if (Strings.equalsIgnoreCase(argument.getName(), name)) list.add(argument);
    return list;
  }

  /**
   * Get an argument by name.
   * @param name the name of the argument.
   * @return the argument (null if not found).
   */
  public getArgumentByName(name: string): WellKnownTextNode {
    let list: AList<WellKnownTextNode> = this.getArgumentsByName(name);
    return list.size() == 0 ? null : list.get(0);
  }

  /**
   * Parse an expression.
   * @param expression the expression.
   * @return the parsed expression.
   */
  public static parse(expression: string): WellKnownTextNode {
    /* Literal ? */
    if (Strings.getLength(expression) >= 2 && Strings.startsWith(expression, '"') && Strings.endsWith(expression, '"'))
      return new WellKnownTextNode(expression, null);
    /* Get the start of the argument list */
    let index1: int32 = Strings.indexOf(expression, "[");
    if (index1 < 0) index1 = Strings.indexOf(expression, "(");
    /* No arguments ? */
    if (index1 < 0) return new WellKnownTextNode(expression, null);
    /* Get the end of the argument list */
    let index2: int32 = Strings.lastIndexOf(expression, "]");
    if (index2 < 0) index2 = Strings.lastIndexOf(expression, ")");
    /* Check */
    ASystem.assertNot(index2 < 0, "Invalid well-known-text '" + expression + "' (missing closing bracket)");
    ASystem.assertNot(index2 < index1, "Invalid well-known-text '" + expression + "' (wrong bracket sequence)");
    /* Get the argument list */
    let argumentList: string = Strings.substring(expression, index1 + 1, index2);
    let arguments1: AList<string> = Strings.splitAdvanced(
      argumentList,
      "," /*separators*/,
      "[(" /*opens*/,
      "])" /*closes*/,
      '"' /*literals*/
    );
    /* Parse the arguments */
    let arguments2: AList<WellKnownTextNode> = new AList<WellKnownTextNode>();
    for (let i: number = 0; i < arguments1.size(); i++)
      arguments2.add(WellKnownTextNode.parse(Strings.trim(arguments1.get(i))));
    /* Get the node name */
    let name: string = Strings.trim(Strings.substring(expression, 0, index1));
    /* Return the node */
    return new WellKnownTextNode(name, arguments2);
  }
}
