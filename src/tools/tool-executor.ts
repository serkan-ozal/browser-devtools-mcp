import { McpSessionContext } from '../context';
import * as logger from '../logger';
import { Tool, ToolInput, ToolOutput } from './types';

export class ToolExecutor {
    private readonly context: McpSessionContext;

    constructor(context: McpSessionContext) {
        this.context = context;
    }

    async executeTool(tool: Tool, args: ToolInput): Promise<ToolOutput> {
        logger.debug(
            `Executing tool ${tool.name()} with input: ${logger.toJson(args)}`
        );
        try {
            const result: ToolOutput = await tool.handle(this.context, args);
            logger.debug(
                `Executed tool ${tool.name()} and got output: ${logger.toJson(result)}`
            );
            return result;
        } catch (err: any) {
            logger.debug(
                `Error occurred while executing ${tool.name()}: ${err}`
            );
            throw err;
        }
    }
}
