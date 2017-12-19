/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { HitSource, HitDetail, HitList } from "./AccuSnap";

// tslint:disable:variable-name

export class LocateOptions {
  public m_disableDgnDbFilter = false;
  public m_allowTransients = false;
  public m_maxHits = 20;
  public m_hitSource = HitSource.DataPoint;
}

export class ElementLocateManager {
  public m_hitList?: HitList;
  public m_currHit?: HitDetail;
  public readonly m_options = new LocateOptions();
}
