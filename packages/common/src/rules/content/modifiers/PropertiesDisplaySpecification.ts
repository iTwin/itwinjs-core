/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module PresentationRules */

/** This is a sub-specification that allows hiding/displaying specified ECInstance properties. */
export interface PropertiesDisplaySpecification {
  /** Comma separated list of ECProperty names which should be included in content. */
  propertyNames: string;
  /** Controls priority of the specification. By default is set to 1000. */
  priority?: number;
  /** Is property displayed. By default is set to true. */
  isDisplayed?: boolean;
}
