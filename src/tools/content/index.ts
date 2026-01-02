import { Tool } from '../types';
import { GetAsHtml } from './get-as-html';
import { GetAsText } from './get-as-text';
import { SaveAsPdf } from './save-as-pdf';
import { TakeScreenshot } from './take-screenshot';

export const tools: Tool[] = [
    new GetAsHtml(),
    new GetAsText(),
    new SaveAsPdf(),
    new TakeScreenshot(),
];
