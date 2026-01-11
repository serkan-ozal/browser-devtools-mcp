import { Tool } from '../types';
import { JsInBrowser } from './js-in-browser';
import { JsInSandbox } from './js-in-sandbox';

export const tools: Tool[] = [new JsInBrowser(), new JsInSandbox()];
