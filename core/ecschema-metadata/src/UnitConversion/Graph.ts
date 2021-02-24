/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// Following https://github.com/dagrejs/graphlib/blob/master/lib/graph.js

// Using generics - T represents Unit | Constant in our use case
interface NodesMap<T> {
  [node: string]: T;
}

// Describe an edge based on its node endpoints (v, w)
interface EdgeObjsMap {
  [edge: string]: {
    v: string;
    w: string;
  };
}

// Describe an edge based on the exponent it carries
interface EdgeLabelsMap {
  [edge: string]: { exponent: number };
}

// Describe the outedges of outer map of nodes; each has an inner map of outedges
interface OutEdgesMap {
  [node: string]: {
    [edges: string]: {
      v: string;
      w: string;
    };
  };
}

export class Graph<T> {
  private _edgeKeyDelim = "\x01";
  private _label = "";
  private _nodeCount = 0;
  private _edgeCount = 0;
  private _nodes: NodesMap<T>;
  private _edgeObjs: EdgeObjsMap;
  private _edgeLabels: EdgeLabelsMap;
  private _outEdges: OutEdgesMap;

  constructor() {
    this._nodes = {};
    this._edgeObjs = {};
    this._edgeLabels = {};
    this._outEdges = {};
  }

  public setGraph = (label: string): Graph<T> => {
    this._label = label;
    return this;
  };

  public graph = () => {
    return this._label;
  };

  public nodeCount = () => {
    return this._nodeCount;
  };

  public nodes = () => {
    return Object.keys(this._nodes);
  };

  public setNode = (nodeKey: string, nodeValue: T) => {
    if (nodeKey in this._nodes) {
      this._nodes[nodeKey] = nodeValue;
      return;
    }
    this._nodes[nodeKey] = nodeValue;
    this._outEdges[nodeKey] = {};
    ++this._nodeCount;
  };

  public node = (nodeKey: string) => {
    return this._nodes[nodeKey];
  };

  public hasNode = (nodeKey: string) => {
    return nodeKey in this._nodes;
  };

  public edgeCount = () => {
    return this._edgeCount;
  };

  public edges = () => {
    return Object.values(this._edgeObjs);
  };

  public setEdge = (v: string, w: string, value: { exponent: number }) => {
    const edgeId = v + this._edgeKeyDelim + w + this._edgeKeyDelim;
    if (edgeId in this._edgeLabels) {
      this._edgeLabels[edgeId] = value;
      return;
    }

    this._edgeLabels[edgeId] = value;
    const edgeObj = {
      v,
      w,
    };
    this._edgeObjs[edgeId] = edgeObj;
    // setNode should have ran first, so this.outEdges[v] shouldn't be undefined
    this._outEdges[v][edgeId] = edgeObj;
    this._edgeCount++;
  };

  public edge = (v: string, w: string) => {
    const edgeId = v + this._edgeKeyDelim + w + this._edgeKeyDelim;
    return this._edgeLabels[edgeId];
  };

  public outEdges = (v: string) => {
    const outV = this._outEdges[v];
    const edges = Object.values(outV);
    return edges;
  };
}
