import { Tool, ToolInput, ToolOutput } from './types';
import { Test } from './test';

export const tools: Tool[] = [new Test()];

export { Tool, ToolInput, ToolOutput };
