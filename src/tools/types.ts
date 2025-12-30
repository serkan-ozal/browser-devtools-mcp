import { ZodRawShape } from 'zod';

import { McpSessionContext } from '../context';

export type ToolInputSchema = ZodRawShape;
export type ToolOutputSchema = ZodRawShape;
export interface ToolInput {}
export interface ToolOutput {}

export interface Tool {
    name(): string;
    description(): string;
    inputSchema(): ToolInputSchema;
    outputSchema(): ToolOutputSchema;
    handle(context: McpSessionContext, args: ToolInput): Promise<ToolOutput>;
}
