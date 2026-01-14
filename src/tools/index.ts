import { Tool, ToolInput, ToolOutput, ToolOutputWithImage } from './types';
import { tools as a11yTools } from './a11y';
import { tools as contentTools } from './content';
import { tools as figmaTools } from './figma';
import { tools as interactionTools } from './interaction';
import { tools as navigationTools } from './navigation';
import { tools as o11yTools } from './o11y';
import { tools as reactTools } from './react';
import { tools as runTools } from './run';
import { tools as stubTools } from './stub';
import { tools as syncTools } from './sync';

export * from './tool-executor';

export const tools: Tool[] = [
    ...a11yTools,
    ...contentTools,
    ...figmaTools,
    ...interactionTools,
    ...navigationTools,
    ...o11yTools,
    ...reactTools,
    ...runTools,
    ...stubTools,
    ...syncTools,
];

export { Tool, ToolInput, ToolOutput, ToolOutputWithImage };
