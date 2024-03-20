/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { IModelConnection } from "@itwin/core-frontend";
import { HierarchyRequestOptions, InstanceKey, Node, NodeKey, RulesetVariable } from "@itwin/presentation-common";
import { Presentation, PresentationManager } from "@itwin/presentation-frontend";
import { collect } from "../../Utils";

interface HierarchyDef<TNode> {
  node: TNode;
  children?: Array<HierarchyDef<TNode>>;
}
type ExpectedHierarchyDef = HierarchyDef<(node: Node) => void>;
export namespace NodeValidators {
  function optionalBooleanToString(value: boolean | undefined) {
    return value === undefined ? "undefined" : value ? "TRUE" : "FALSE";
  }
  function validateBaseNodeAttributes(
    node: Node,
    expectations: {
      label?: string;
      hasChildren?: boolean;
      supportsFiltering?: boolean;
    },
  ) {
    if (expectations.label && node.label.displayValue !== expectations.label) {
      throw new Error(`Expected node label to be "${expectations.label}", got "${node.label.displayValue}"`);
    }
    if (expectations.hasChildren !== undefined && node.hasChildren !== expectations.hasChildren) {
      throw new Error(
        `Expected node's \`hasChildren\` flag to be ${optionalBooleanToString(expectations.hasChildren)}, got ${optionalBooleanToString(node.hasChildren)}`,
      );
    }
    if (expectations.supportsFiltering !== undefined && node.supportsFiltering !== expectations.supportsFiltering) {
      throw new Error(
        `Expected node's \`supportsFiltering\` flag to be "${optionalBooleanToString(expectations.supportsFiltering)}", got "${optionalBooleanToString(node.supportsFiltering)}"`,
      );
    }
  }
  export function createForInstanceNode(props: {
    instanceKeys: InstanceKey[];
    label?: string;
    expectChildren?: boolean;
    children?: ExpectedHierarchyDef[];
    supportsFiltering?: boolean;
  }): ExpectedHierarchyDef {
    return {
      node: (node) => {
        if (!NodeKey.isInstancesNodeKey(node.key)) {
          throw new Error(`Expected an instance node, got "${node.key.type}"`);
        }
        if (
          node.key.instanceKeys.length !== props.instanceKeys.length ||
          !node.key.instanceKeys.every((nk) => props.instanceKeys.some((ek) => 0 === InstanceKey.compare(nk, ek)))
        ) {
          throw new Error(`Expected node to represent instance keys ${JSON.stringify(props.instanceKeys)}, got ${JSON.stringify(node.key.instanceKeys)}`);
        }
        validateBaseNodeAttributes(node, {
          label: props.label,
          hasChildren: props.expectChildren ?? (props.children && props.children.length > 0),
          supportsFiltering: props.supportsFiltering,
        });
      },
      children: props.children,
    };
  }
  export function createForClassGroupingNode(props: {
    className: string;
    label?: string;
    expectChildren?: boolean;
    children?: ExpectedHierarchyDef[];
    supportsFiltering?: boolean;
  }): ExpectedHierarchyDef {
    return {
      node: (node) => {
        if (!NodeKey.isClassGroupingNodeKey(node.key)) {
          throw new Error(`Expected a class grouping node, got "${node.key.type}"`);
        }
        if (node.key.className !== props.className) {
          throw new Error(`Expected node to represent class "${props.className}", got "${node.key.className}"`);
        }
        validateBaseNodeAttributes(node, {
          label: props.label,
          hasChildren: props.expectChildren ?? (props.children && props.children.length > 0),
          supportsFiltering: props.supportsFiltering,
        });
      },
      children: props.children,
    };
  }
  export function createForPropertyGroupingNode(props: {
    className: string;
    propertyName: string;
    groupingValues?: any[];
    label?: string;
    expectChildren?: boolean;
    children?: ExpectedHierarchyDef[];
    supportsFiltering?: boolean;
  }): ExpectedHierarchyDef {
    return {
      node: (node) => {
        if (!NodeKey.isPropertyGroupingNodeKey(node.key)) {
          throw new Error(`Expected a property grouping node, got "${node.key.type}"`);
        }
        if (node.key.className !== props.className) {
          throw new Error(`Expected node to represent a property from class "${props.className}", got "${node.key.className}"`);
        }
        if (node.key.propertyName !== props.propertyName) {
          throw new Error(`Expected node to represent a property "${props.propertyName}", got "${node.key.propertyName}"`);
        }
        if (
          props.groupingValues &&
          (node.key.groupingValues.length !== props.groupingValues.length || !node.key.groupingValues.every((v) => props.groupingValues!.includes(v)))
        ) {
          throw new Error(`Expected node to group values ${JSON.stringify(props.groupingValues)}, got ${JSON.stringify(node.key.groupingValues)}`);
        }
        validateBaseNodeAttributes(node, {
          label: props.label,
          hasChildren: props.expectChildren ?? (props.children && props.children.length > 0),
          supportsFiltering: props.supportsFiltering,
        });
      },
      children: props.children,
    };
  }
  export function createForLabelGroupingNode(props: {
    label: string;
    expectChildren?: boolean;
    children?: ExpectedHierarchyDef[];
    supportsFiltering?: boolean;
  }): ExpectedHierarchyDef {
    return {
      node: (node) => {
        if (!NodeKey.isLabelGroupingNodeKey(node.key)) {
          throw new Error(`Expected a label grouping node, got "${node.key.type}"`);
        }
        validateBaseNodeAttributes(node, {
          label: props.label,
          hasChildren: props.expectChildren ?? (props.children && props.children.length > 0),
          supportsFiltering: props.supportsFiltering,
        });
      },
      children: props.children,
    };
  }
}

export async function validateHierarchy(props: {
  manager?: PresentationManager;
  requestParams: HierarchyRequestOptions<IModelConnection, NodeKey, RulesetVariable>;
  configureParams?: (params: HierarchyRequestOptions<IModelConnection, NodeKey, RulesetVariable>) => void;
  expectedHierarchy: ExpectedHierarchyDef[];
  supportsFiltering?: boolean;
}) {
  const manager = props.manager ?? Presentation.presentation;

  const requestParams = { ...props.requestParams };
  if (props.configureParams) {
    props.configureParams(requestParams);
  }

  const nodes = await manager.getNodesIterator(requestParams).then(async (x) => collect(x.items));

  if (nodes.length !== props.expectedHierarchy.length) {
    throw new Error(`Expected ${props.expectedHierarchy.length} nodes, got ${nodes.length}`);
  }

  if (props.supportsFiltering !== undefined) {
    // TODO: validate the `supportsFiltering` flag once `PresentationManager.getNodes` API is updated to return it
  }

  const resultHierarchy = new Array<HierarchyDef<NodeKey>>();

  for (let i = 0; i < nodes.length; ++i) {
    const actualNode = nodes[i];
    resultHierarchy.push({ node: actualNode.key });

    const expectation = props.expectedHierarchy[i];
    expectation.node(actualNode);

    const childrenParams = { ...requestParams, parentKey: actualNode.key };
    if (!NodeKey.isGroupingNodeKey(actualNode.key)) {
      delete childrenParams.instanceFilter;
    }

    resultHierarchy[resultHierarchy.length - 1].children = await validateHierarchy({
      ...props,
      requestParams: childrenParams,
      expectedHierarchy: expectation.children ?? [],
    });
  }

  return resultHierarchy;
}
