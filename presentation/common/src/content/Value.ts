/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Content */

import { NestedContent } from "./Fields";
import { ValuesDictionary } from "../Utils";

export type Value = string | number | boolean | undefined | ValuesMap | ValuesArray | NestedContent[];
export interface ValuesMap extends ValuesDictionary<Value> { }
export interface ValuesArray extends Array<Value> { }

export type DisplayValue = string | undefined | DisplayValuesMap | DisplayValuesArray;
export interface DisplayValuesMap extends ValuesDictionary<DisplayValue> { }
export interface DisplayValuesArray extends Array<DisplayValue> { }
