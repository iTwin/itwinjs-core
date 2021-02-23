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
  EDGE_KEY_DELIM = "\x01";
  _label = "";
  _nodeCount = 0;
  _edgeCount = 0;
  _nodes: NodesMap<T>;
  _edgeObjs: EdgeObjsMap;
  _edgeLabels: EdgeLabelsMap;
  _outEdges: OutEdgesMap;

  constructor() {
    this._nodes = {};
    this._edgeObjs = {};
    this._edgeLabels = {};
    this._outEdges = {};
  }

  setGraph = (label: string): Graph<T> => {
    this._label = label;
    return this;
  };

  graph = () => {
    return this._label;
  };

  nodeCount = () => {
    return this._nodeCount;
  };

  nodes = () => {
    return Object.keys(this._nodes);
  };

  setNode = (nodeKey: string, nodeValue: T) => {
    if (nodeKey in this._nodes) {
      this._nodes[nodeKey] = nodeValue;
      return;
    }
    this._nodes[nodeKey] = nodeValue;
    this._outEdges[nodeKey] = {};
    ++this._nodeCount;
  };

  node = (nodeKey: string) => {
    return this._nodes[nodeKey];
  };

  hasNode = (nodeKey: string) => {
    return nodeKey in this._nodes;
  };

  edgeCount = () => {
    return this._edgeCount;
  };

  edges = () => {
    return Object.values(this._edgeObjs);
  };

  setEdge = (v: string, w: string, value: { exponent: number }) => {
    let edgeId = v + this.EDGE_KEY_DELIM + w + this.EDGE_KEY_DELIM;
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

  edge = (v: string, w: string) => {
    let edgeId = v + this.EDGE_KEY_DELIM + w + this.EDGE_KEY_DELIM;
    return this._edgeLabels[edgeId];
  };

  outEdges = (v: string) => {
    let outV = this._outEdges[v];
    let edges = Object.values(outV);
    return edges;
  };
}
