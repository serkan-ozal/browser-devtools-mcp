import { Tool } from '../types';
import { GoBack } from './go-back';
import { GoForward } from './go-forward';
import { GoTo } from './go-to';
import { Reload } from './reload';

export const tools: Tool[] = [
    new GoBack(),
    new GoForward(),
    new GoTo(),
    new Reload(),
];
