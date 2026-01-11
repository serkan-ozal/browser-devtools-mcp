import { Tool } from '../types';
import { Click } from './click';
import { Drag } from './drag';
import { Fill } from './fill';
import { Hover } from './hover';
import { PressKey } from './press-key';
import { ResizeViewport } from './resize-viewport';
import { ResizeWindow } from './resize-window';
import { Select } from './select';
import { Scroll } from './scroll';

export const tools: Tool[] = [
    new Click(),
    new Drag(),
    new Fill(),
    new Hover(),
    new PressKey(),
    new ResizeViewport(),
    new ResizeWindow(),
    new Select(),
    new Scroll(),
];
