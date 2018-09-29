/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/* tslint:disable: no-console */

import { Point3d } from "../PointVector";
import { assert } from "chai";

console.log("=========================");
console.log("Standalone Output");
console.log("=========================");

const point0 = Point3d.create(0, 0.001, 586);
const point1 = Point3d.create(5, 0, -192);

point1.setFrom(point0);

assert.isTrue(point0.isAlmostEqual(point1), "Points are expected to be equal");
