/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { UnitConversionGraph } from "../../UnitConversion/Graph";

describe("UnitConversionGraph", () => {
  it("starts empty", () => {
    const g = new UnitConversionGraph<string>();
    expect(g.nodeCount()).toBe(0);
    expect(g.edgeCount()).toBe(0);
  });

  it("adds nodes", () => {
    const g = new UnitConversionGraph<string>();
    g.setNode("a", "A");
    g.setNode("b", "B");
    expect(g.nodeCount()).toBe(2);
    expect(g.node("a")).toBe("A");
    expect(g.hasNode("a")).toBe(true);
    expect(g.hasNode("c")).toBe(false);
  });

  it("updates existing node value", () => {
    const g = new UnitConversionGraph<string>();
    g.setNode("a", "A1");
    g.setNode("a", "A2");
    expect(g.nodeCount()).toBe(1);
    expect(g.node("a")).toBe("A2");
  });

  it("adds edges", () => {
    const g = new UnitConversionGraph<string>();
    g.setNode("a", "A");
    g.setNode("b", "B");
    g.setEdge("a", "b", { exponent: 1 });
    expect(g.edgeCount()).toBe(1);
    expect(g.edge("a", "b").exponent).toBe(1);
  });

  it("accumulates exponents on duplicate edges", () => {
    const g = new UnitConversionGraph<string>();
    g.setNode("a", "A");
    g.setNode("b", "B");
    g.setEdge("a", "b", { exponent: 2 });
    g.setEdge("a", "b", { exponent: 3 });
    expect(g.edgeCount()).toBe(1);
    expect(g.edge("a", "b").exponent).toBe(5);
  });

  it("lists outgoing edges", () => {
    const g = new UnitConversionGraph<string>();
    g.setNode("a", "A");
    g.setNode("b", "B");
    g.setNode("c", "C");
    g.setEdge("a", "b", { exponent: 1 });
    g.setEdge("a", "c", { exponent: -1 });
    const out = g.outEdges("a");
    expect(out).toHaveLength(2);
    const ws = out.map((e) => e.w).sort();
    expect(ws).toEqual(["b", "c"]);
  });

  it("lists all nodes", () => {
    const g = new UnitConversionGraph<number>();
    g.setNode("x", 1);
    g.setNode("y", 2);
    expect(g.nodes().sort()).toEqual(["x", "y"]);
  });

  it("sets and gets graph label", () => {
    const g = new UnitConversionGraph<string>();
    g.setGraph("test");
    expect(g.graph()).toBe("test");
  });
});
