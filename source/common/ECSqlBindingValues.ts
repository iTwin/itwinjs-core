/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";

/** A DateTime value which can be bound to an ECSQL parameter
 */
export class DateTime {
  /** Contructor
   * @param isoString ISO 8601 formatted date time string
   */
   public constructor(public isoString: string) {}
}

/** A Navigation property value which can be bound to an ECSQL parameter
 */
export class NavigationValue {
  /** Contructor
   * @param navId ECInstanceId of the related instance
   * @param relClassName Fully qualified class name of the relationship backing the Navigation property
   * @param relClassTableSpace Table space where the relationship's schema is persisted. This is only required
   * if other ECDb files are attached to the primary one. In case a schema exists in more than one of the files,
   * pass the table space to disambiguate.
   */
   public constructor(public navId: Id64, public relClassName?: string, public relClassTableSpace?: string) {}
}

/** A BLOB value which can be bound to an ECSQL parameter
 */
export class Blob {
  /** Contructor
   * @param value BLOB formatted as Base64 string
   */
   public constructor(public base64: string) {}
}
