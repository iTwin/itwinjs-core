/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as dotenv from 'dotenv';
import * as jsdom_global from 'jsdom-global';
import { JSDOM } from 'jsdom';
dotenv.config();

jsdom_global();
window.Date = Date;
document.elementFromPoint = () => null;

global.DOMParser = new JSDOM().window.DOMParser;
