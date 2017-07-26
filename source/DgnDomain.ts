/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/**
 * The interface that must be implemented by domain / schema objects.
 */
export interface DgnDomain {

  /** The name of the domain and its corresponding ECSchema. */
  domainName: string;
}

/**
 * Manages registered domains
 */
export class DgnDomains {

  private static registeredDomains: { [key: string]: DgnDomain; } = {};

  /**
   * Register a domain prior to using it.
   * @param domain The domain
   */
  public static registerDomain(domain: DgnDomain) {
    const key: string = domain.domainName.toLowerCase();
    if (DgnDomains.getRegisteredDomain(key))
      throw new Error("domain " + key + " is already registered");
    DgnDomains.registeredDomains[key] = domain;
  }

  /**
   * Look up a previously registered domain
   * @param domainName The name of the domain
   * @return the previously registered domain or undefined if not registered.
   */
  public static getRegisteredDomain(domainName: string) {
    return DgnDomains.registeredDomains[domainName.toLowerCase()];
  }
}
