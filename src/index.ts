#!/usr/bin/env node

import * as config from './config';
import * as logger from './logger';
import { startStdioServer, startStreamableHTTPServer } from './mcp-server';

import { Command, Option, InvalidOptionArgumentError } from 'commander';

type Options = {
    transport: 'stdio' | 'streamable-http';
    port: number;
};

function _parsePort(value: string): number {
    const n: number = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
        throw new InvalidOptionArgumentError(
            'port must be an integer between 1 and 65535'
        );
    }
    return n;
}

function _getOptions(): Options {
    const program: Command = new Command()
        .addOption(
            new Option('--transport <type>', 'transport type')
                .choices(['stdio', 'streamable-http'])
                .default('stdio')
        )
        .addOption(
            new Option('--port <number>', 'port for Streamable HTTP transport')
                .argParser(_parsePort)
                .default(config.PORT)
        )
        .allowUnknownOption()
        .parse(process.argv);

    return program.opts<Options>();
}

async function main(): Promise<void> {
    const options: Options = _getOptions();
    if (options.transport === 'stdio') {
        logger.disable();
        await startStdioServer();
    } else if (options.transport === 'streamable-http') {
        logger.info('Starting MCP server...');
        await startStreamableHTTPServer(options.port);
        logger.info('Started MCP Server');
    } else {
        logger.error(`Invalid transport: ${options.transport}`);
        process.exit(1);
    }
}

main().catch((err: any): never => {
    logger.enable();
    logger.error('MCP server error', err);
    process.exit(1);
});
