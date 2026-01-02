import { Tool, ToolInput, ToolOutput, ToolOutputWithImage } from './types';
import { tools as a11yTools } from './a11y';
import { tools as contentTools } from './content';
import { tools as interactionTools } from './interaction';
import { tools as monitoringTools } from './monitoring';
import { tools as navigationTools } from './navigation';

export * from './tool-executor';

export const tools: Tool[] = [
    ...a11yTools,
    ...contentTools,
    ...interactionTools,
    ...monitoringTools,
    ...navigationTools,
];

export { Tool, ToolInput, ToolOutput, ToolOutputWithImage };
