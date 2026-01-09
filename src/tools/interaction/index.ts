import { Tool } from '../types';
import { Click } from './click';
import { Drag } from './drag';
import { Evaluate } from './evaluate';
import { Fill } from './fill';
import { Hover } from './hover';
import { PressKey } from './press-key';
import { Select } from './select';
import { Scroll } from './scroll';

export const tools: Tool[] = [
    new Click(),
    new Drag(),
    new Evaluate(),
    new Fill(),
    new Hover(),
    new PressKey(),
    new Select(),
    new Scroll(),
];
