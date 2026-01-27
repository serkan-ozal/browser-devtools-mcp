import { Command, Option } from 'commander';
import { ZodFirstPartyTypeKind, ZodTypeAny } from 'zod';

import { Tool, ToolInputSchema } from '../tools/types';

/**
 * Extracts the inner type from optional/default/nullable wrappers
 */
function _unwrapZodType(zodType: ZodTypeAny): {
    innerType: ZodTypeAny;
    isOptional: boolean;
    defaultValue: any;
} {
    let current: ZodTypeAny = zodType;
    let isOptional: boolean = false;
    let defaultValue: any = undefined;

    while (true) {
        const typeName: ZodFirstPartyTypeKind = current._def.typeName;

        if (typeName === ZodFirstPartyTypeKind.ZodOptional) {
            isOptional = true;
            current = current._def.innerType;
        } else if (typeName === ZodFirstPartyTypeKind.ZodDefault) {
            isOptional = true;
            defaultValue = current._def.defaultValue();
            current = current._def.innerType;
        } else if (typeName === ZodFirstPartyTypeKind.ZodNullable) {
            isOptional = true;
            current = current._def.innerType;
        } else {
            break;
        }
    }

    return { innerType: current, isOptional, defaultValue };
}

/**
 * Gets description from a Zod type
 */
function _getDescription(zodType: ZodTypeAny): string | undefined {
    return zodType._def.description;
}

/**
 * Converts kebab-case or snake_case to camelCase for option names
 */
function _toCamelCase(str: string): string {
    return str.replace(/[-_]([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Converts camelCase to kebab-case for CLI flags
 */
function _toKebabCase(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Creates a Commander Option from a Zod type
 */
function _createOption(name: string, zodType: ZodTypeAny): Option | null {
    const { innerType, isOptional, defaultValue } = _unwrapZodType(zodType);
    const description: string = _getDescription(zodType) || `The ${name} value`;
    const flagName: string = _toKebabCase(name);
    const typeName: ZodFirstPartyTypeKind = innerType._def.typeName;

    let option: Option;

    switch (typeName) {
        case ZodFirstPartyTypeKind.ZodString:
            option = new Option(`--${flagName} <string>`, description);
            break;

        case ZodFirstPartyTypeKind.ZodNumber:
            option = new Option(`--${flagName} <number>`, description);
            option.argParser((value: string): number => {
                const n: number = Number(value);
                if (!Number.isFinite(n)) {
                    throw new Error(`Invalid number: ${value}`);
                }
                return n;
            });
            break;

        case ZodFirstPartyTypeKind.ZodBoolean:
            // Boolean flags don't take a value
            option = new Option(`--${flagName}`, description);
            break;

        case ZodFirstPartyTypeKind.ZodEnum:
            const enumValues: string[] = innerType._def.values;
            option = new Option(`--${flagName} <choice>`, description).choices(
                enumValues
            );
            break;

        case ZodFirstPartyTypeKind.ZodArray:
            // Array options can be specified multiple times
            option = new Option(`--${flagName} <value...>`, description);
            break;

        case ZodFirstPartyTypeKind.ZodObject:
        case ZodFirstPartyTypeKind.ZodRecord:
            // Objects and records are passed as JSON strings
            option = new Option(`--${flagName} <json>`, description);
            option.argParser((value: string): object => {
                try {
                    return JSON.parse(value);
                } catch {
                    throw new Error(`Invalid JSON: ${value}`);
                }
            });
            break;

        case ZodFirstPartyTypeKind.ZodAny:
        case ZodFirstPartyTypeKind.ZodUnknown:
            // Any/unknown types: try JSON parse, fallback to string
            option = new Option(`--${flagName} <value>`, description);
            option.argParser((value: string): any => {
                try {
                    return JSON.parse(value);
                } catch {
                    return value;
                }
            });
            break;

        case ZodFirstPartyTypeKind.ZodLiteral:
            // Literal types have a fixed value, treat as optional flag
            const literalValue: any = innerType._def.value;
            if (typeof literalValue === 'boolean') {
                option = new Option(`--${flagName}`, description);
            } else {
                option = new Option(`--${flagName} <value>`, description);
                option.default(literalValue);
            }
            break;

        case ZodFirstPartyTypeKind.ZodUnion:
            // Union types: check if it's a union of literals (like enum)
            const unionOptions: ZodTypeAny[] = innerType._def.options;
            const allLiterals: boolean = unionOptions.every(
                (opt: ZodTypeAny) =>
                    opt._def.typeName === ZodFirstPartyTypeKind.ZodLiteral
            );
            if (allLiterals) {
                const choices: string[] = unionOptions.map((opt: ZodTypeAny) =>
                    String(opt._def.value)
                );
                option = new Option(
                    `--${flagName} <choice>`,
                    description
                ).choices(choices);
            } else {
                // Mixed union, treat as JSON
                option = new Option(`--${flagName} <value>`, description);
                option.argParser((value: string): any => {
                    try {
                        return JSON.parse(value);
                    } catch {
                        return value;
                    }
                });
            }
            break;

        default:
            // For unsupported types, treat as string
            option = new Option(`--${flagName} <value>`, description);
            break;
    }

    // Set default value if exists
    if (defaultValue !== undefined) {
        option.default(defaultValue);
    }

    // Mark as required if not optional and no default
    if (!isOptional && defaultValue === undefined) {
        option.makeOptionMandatory(true);
    }

    return option;
}

/**
 * Generates Commander Options from a Tool's input schema
 */
function _generateOptionsFromSchema(schema: ToolInputSchema): Option[] {
    const options: Option[] = [];

    for (const [name, zodType] of Object.entries(schema)) {
        const option: Option | null = _createOption(
            name,
            zodType as ZodTypeAny
        );
        if (option) {
            options.push(option);
        }
    }

    return options;
}

/**
 * Parses command line options back to tool input format
 * Handles camelCase conversion from kebab-case flags
 */
function _parseOptionsToToolInput<T extends object>(
    options: Record<string, any>
): T {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(options)) {
        // Commander already converts kebab-case to camelCase
        // but we need to handle any edge cases
        const camelKey: string = _toCamelCase(key);
        if (value !== undefined) {
            result[camelKey] = value;
        }
    }

    return result as T;
}

/**
 * Tool action handler type
 */
export type ToolActionHandler = (
    toolName: string,
    toolInput: Record<string, any>,
    globalOptions: Record<string, any>
) => Promise<void>;

/**
 * Parses a tool name into domain and command parts
 * e.g., "navigation_go-to" -> { domain: "navigation", commandName: "go-to" }
 */
function _parseToolName(toolName: string): {
    domain: string;
    commandName: string;
} {
    const underscoreIndex: number = toolName.indexOf('_');
    if (underscoreIndex === -1) {
        return { domain: 'default', commandName: toolName };
    }
    return {
        domain: toolName.substring(0, underscoreIndex),
        commandName: toolName.substring(underscoreIndex + 1),
    };
}

/**
 * Registers all tools as nested subcommands on the given program
 * Tool names like "navigation_go-to" become "navigation go-to"
 *
 * @example
 * ```typescript
 * import { Command } from 'commander';
 * import { tools } from './tools';
 * import { registerToolCommands } from './utils/cli-utils';
 *
 * const program = new Command('browser-devtools');
 *
 * registerToolCommands(program, tools, async (toolName, toolInput, globalOpts) => {
 *     // Call daemon server with toolName and toolInput
 *     // Use globalOpts.sessionId for session management
 * });
 *
 * program.parse();
 *
 * // Usage: browser-devtools navigation go-to --url "https://example.com"
 * ```
 */
export function registerToolCommands(
    program: Command,
    tools: Tool[],
    handler: ToolActionHandler
): void {
    // Group tools by domain
    const domainCommands: Map<string, Command> = new Map();

    for (const tool of tools) {
        const { domain, commandName } = _parseToolName(tool.name());

        // Get or create domain command
        let domainCommand: Command | undefined = domainCommands.get(domain);
        if (!domainCommand) {
            domainCommand = new Command(domain).description(
                `${domain.charAt(0).toUpperCase() + domain.slice(1)} commands`
            );
            domainCommands.set(domain, domainCommand);
            program.addCommand(domainCommand);
        }

        // Create tool command with just the command name (without domain prefix)
        const toolCommand: Command = new Command(commandName).description(
            tool.description().trim()
        );

        // Add options from schema
        const options: Option[] = _generateOptionsFromSchema(
            tool.inputSchema()
        );
        for (const option of options) {
            toolCommand.addOption(option);
        }

        // Set action handler
        toolCommand.action(async (opts: Record<string, any>) => {
            const toolInput: Record<string, any> =
                _parseOptionsToToolInput(opts);
            const globalOptions: Record<string, any> = program.opts();
            await handler(tool.name(), toolInput, globalOptions);
        });

        domainCommand.addCommand(toolCommand);
    }
}
