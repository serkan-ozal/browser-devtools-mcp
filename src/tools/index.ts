import { Tool, ToolInput, ToolOutput } from './types';
import { tools as contentTools } from './content';
import { tools as interactionTools } from './interaction';
import { tools as monitoringTools } from './monitoring';
import { tools as navigationTools } from './navigation';

export * from './tool-executor';

export const tools: Tool[] = [
    ...contentTools,
    ...interactionTools,
    ...monitoringTools,
    ...navigationTools,
];

export { Tool, ToolInput, ToolOutput };
