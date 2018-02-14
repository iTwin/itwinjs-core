/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway } from "$(iModelJs-Common)/lib/common/Gateway";

/** Sample gateway definition. */
export default abstract class SampleGateway extends Gateway {
  /** The version of the gateway. */
  public static version = "1.0.0";

  /** The types that can be marshaled by the gateway. */
  public static types = () => [
  ]

  public abstract getSampleImodels(): Promise<string[]>;
}
