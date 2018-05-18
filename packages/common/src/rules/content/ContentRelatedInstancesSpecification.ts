/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

import { ContentSpecificationBase } from "./ContentSpecification";
import { RelationshipDirection } from "../RelationshipDirection";
import { PresentationRuleSpecificationTypes } from "../PresentationRuleSpecification";

/**
 * Returns specified related ECInstance(s) for selected node.
 *
 * **Precondition:** This specification should be used only if selected node is ECInstance node. If selected node is
 * CustomNode, it will search up for the first parent ECInstance node.
 *
 * **Note:** Use ContentRule condition to apply specification on correct selected node.
 */
export interface ContentRelatedInstancesSpecification extends ContentSpecificationBase {
  /** Used for serializing to JSON. */
  type: PresentationRuleSpecificationTypes.ContentRelatedInstancesSpecification;

  /**
   * Skips defined level of related items and shows next level related items.
   * By default is set to 0.
   *
   * **Warning:** Can't be used together with [[isRecursive]].
   */
  skipRelatedLevel?: number;

  /**
   * Walks the specified relationships recursively to find related instances. By default is set to false.
   *
   * **Warning:** Can't be used together with [[skipRelatedLevel]].
   */
  isRecursive?: boolean;

  /**
   * Condition for filtering instances of defined related classes.
   *
   * **See Also:** [ECExpressions Available in InstanceFilter]($docs/learning/content/ECExpressions.md#instance-filter)
   */
  instanceFilter?: string;

  /**
   * Direction that will be followed in the relationship select criteria. Possible options: `Forward`, `Backward`, `Both`.
   * By default is set to `Both`.
   */
  requiredDirection?: RelationshipDirection;

  /**
   * Names of ECRelationshipClasses separated by comma.
   * Format: `SchemaName1:ClassName11,ClassName12;SchemaName2:ClassName21,ClassName22`.
   * Optional if [[relatedClassNames]] is specified.
   */
  relationshipClassNames?: string;

  /**
   * Names of related ECClasses separated by comma.
   * Format: `SchemaName1:ClassName11,ClassName12;SchemaName2:ClassName21,ClassName22`.
   * Optional if [[relationshipClassNames]] is specified.
   */
  relatedClassNames?: string;
}
