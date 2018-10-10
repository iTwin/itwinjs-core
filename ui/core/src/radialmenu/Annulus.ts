/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RadialMenu */

/** @hidden
 * 2D Point
 */
export class Point {
  public x: number = 0;
  public y: number = 0;
  constructor(x?: number, y?: number) {
    this.x = x || 0;
    this.y = y || 0;
  }
  /**
   * Calculates the 2D Euclidean distance between this point and the parameter p
   */
  public distTo = (p: Point) => {
    const dx = this.x - p.x;
    const dy = this.y - p.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** checks for equality with the components of this, and point parameter */
  public equals = (point: Point) => this.x === point.x && this.y === point.y;
}

/** @hidden
 * 2D Line consisting of a start point, and an end point
 */
export class Line {
  public p1: Point;
  public p2: Point;

  constructor(p1?: Point, p2?: Point) {
    this.p1 = p1 || new Point();
    this.p2 = p2 || new Point();
  }

  /** checks for equality with the components of this, and line parameter */
  public equals = (line: Line) => this.p1.equals(line.p1) && this.p2.equals(line.p2);
}

/** @hidden
 * 2D Circle
 */
export class Circle {
  public center: Point;
  public radius: number;
  constructor(center?: Point, radius?: number) {
    this.center = center || new Point();
    this.radius = radius || 0;
  }
}

/** @hidden
 * 2D Annulus (2D doughnut shape/flattened torus) defined by an inner and outer circle with a shared center point.
 */
export class Annulus {
  public center: Point;
  public inner: Circle;
  public outer: Circle;

  constructor(center?: Point, innerRadius?: number, outerRadius?: number) {
    this.center = center || new Point();

    this.inner = new Circle(center, innerRadius);
    this.outer = new Circle(center, outerRadius);
  }
}

/** @hidden
 * 2D Sector of an Annulus, defined by both a parent annulus, a startAngle, and an endAngle.
 */
export class AnnularSector {
  public parent: Annulus;
  public startAngle: number;
  public endAngle: number;

  public path: string;

  public innerStart: Point;
  public outerStart: Point;
  public start: Line;
  public innerEnd: Point;
  public outerEnd: Point;
  public end: Line;

  /**
   * initialize AnnularSector on parent annulus, and generate SVG Path to store in this.path
   * @param parent parent annulus to initialize sector on.
   * @param startAngle angle to begin the annular sector on.
   * @param endAngle angle to end the annular sector on.
   */
  constructor(parent: Annulus, startAngle: number, endAngle: number) {
    this.parent = parent;
    this.startAngle = startAngle;
    this.endAngle = endAngle;

    // adapted from https://gist.github.com/buschtoens/4190516
    const { x: cx, y: cy } = parent.center;
    const inner = parent.inner.radius;
    const outer = parent.outer.radius;

    this.innerStart = new Point(cx + inner * Math.cos(startAngle), cy + inner * Math.sin(startAngle));
    this.outerStart = new Point(cx + outer * Math.cos(startAngle), cy + outer * Math.sin(startAngle));
    this.start = new Line(this.innerStart, this.outerStart);

    this.outerEnd = new Point(cx + outer * Math.cos(endAngle), cy + outer * Math.sin(endAngle));
    this.innerEnd = new Point(cx + inner * Math.cos(endAngle), cy + inner * Math.sin(endAngle));
    this.end = new Line(this.outerEnd, this.innerEnd);

    const angleDiff = endAngle - startAngle;
    const largeArc = (angleDiff % (Math.PI * 2)) > Math.PI ? 1 : 0;

    const sectorCommands = [];

    sectorCommands.push(`M${this.innerStart.x},${this.innerStart.y}`); // moveTo
    sectorCommands.push(`L${this.outerStart.x},${this.outerStart.y}`); // lineTo
    sectorCommands.push(`A${outer},${outer} 0 ${largeArc} 1 ${this.outerEnd.x},${this.outerEnd.y}`); // arcTo
    sectorCommands.push(`L${this.innerEnd.x},${this.innerEnd.y}`); // lineTo
    sectorCommands.push(`A${inner},${inner} 0 ${largeArc} 0 ${this.innerStart.x},${this.innerStart.y}`); // arcTo
    sectorCommands.push(`z`); // closePath

    this.path = sectorCommands.join(" ");
  }
}
