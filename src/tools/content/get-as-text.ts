import { ToolSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';

import { z } from 'zod';

const DEFAULT_MAX_TEXT_LENGTH = 50_000;

export interface GetAsTextInput extends ToolInput {
    selector?: string;
    maxLength: number;
}

export interface GetAsTextOutput extends ToolOutput {
    output: string;
}

export class GetAsText implements Tool {
    name(): string {
        return 'content_get-as-text';
    }

    description(): string {
        return 'Gets the visible text content of the current page.';
    }

    inputSchema(): ToolInputSchema {
        return {
            selector: z
                .string()
                .describe(
                    'CSS selector to limit the text content to a specific container.'
                )
                .optional(),
            maxLength: z
                .number()
                .int()
                .positive()
                .describe(
                    `Maximum number of characters to return (default: "${DEFAULT_MAX_TEXT_LENGTH}").`
                )
                .optional()
                .default(DEFAULT_MAX_TEXT_LENGTH),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {
            output: z
                .string()
                .describe('The requested text content of the page.'),
        };
    }

    async handle(
        context: ToolSessionContext,
        args: GetAsTextInput
    ): Promise<GetAsTextOutput> {
        const { selector, maxLength } = args;

        const visibleText: string = await context.page.evaluate(
            ({ selector }): string => {
                const root: Element | null = selector
                    ? document.querySelector(selector)
                    : document.body;

                if (!root) {
                    throw new Error(
                        `Element with selector "${selector}" not found`
                    );
                }

                const walker: TreeWalker = document.createTreeWalker(
                    root,
                    NodeFilter.SHOW_TEXT,
                    {
                        acceptNode: (node: Node) => {
                            const style: CSSStyleDeclaration =
                                window.getComputedStyle(node.parentElement!);
                            return style.display !== 'none' &&
                                style.visibility !== 'hidden'
                                ? NodeFilter.FILTER_ACCEPT
                                : NodeFilter.FILTER_REJECT;
                        },
                    }
                );
                let text: string = '';
                let node;
                while ((node = walker.nextNode())) {
                    const trimmedText: string | undefined =
                        node.textContent?.trim();
                    if (trimmedText) {
                        text += trimmedText + '\n';
                    }
                }
                return text.trim();
            },
            { selector }
        );

        // Truncate logic
        let output: string = visibleText;
        if (output.length > maxLength) {
            output =
                output.slice(0, maxLength) +
                '\n[Output truncated due to size limits]';
        }
        return {
            output,
        };
    }
}
