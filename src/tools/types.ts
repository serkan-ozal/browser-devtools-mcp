import { ZodRawShape } from 'zod';

import { ToolSessionContext } from '../context';

export type ToolInputSchema = ZodRawShape;
export type ToolOutputSchema = ZodRawShape;
export interface ToolInput {}
export interface ToolOutput {}
export interface ToolOutputWithImage extends ToolOutput {
    image?: {
        data: Buffer;
        mimeType: string;
    };
}

export interface Tool {
    name(): string;
    description(): string;
    inputSchema(): ToolInputSchema;
    outputSchema(): ToolOutputSchema;
    handle(context: ToolSessionContext, args: ToolInput): Promise<ToolOutput>;
}
