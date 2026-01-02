import { Tool } from '../types';
import { TakeAriaSnapshot } from './take-aria-snapshot';
import { TakeAxTreeSnapshot } from './take-ax-tree-snapshot';

export const tools: Tool[] = [new TakeAriaSnapshot(), new TakeAxTreeSnapshot()];
