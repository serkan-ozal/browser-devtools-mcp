import { McpSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';

import type { ElementHandle } from 'playwright';
import { z } from 'zod';

const DEFAULT_MAX_HTML_LENGTH = 50_000;

export interface GetAsHtmlInput extends ToolInput {
    selector: string;
    removeScripts: boolean;
    removeComments: boolean;
    removeStyles: boolean;
    removeMeta: boolean;
    cleanHtml: boolean;
    minify: boolean;
    maxLength: number;
}

export interface GetAsHtmlOutput extends ToolOutput {
    output: string;
}

export class GetAsHtml implements Tool {
    name(): string {
        return 'content_get-as-html';
    }

    description(): string {
        return `
Gets the HTML content of the current page. 
By default, all <script> tags are removed from the output unless "removeScripts" is explicitly set to "false".
        `;
    }

    inputSchema(): ToolInputSchema {
        return {
            selector: z
                .string()
                .describe(
                    'CSS selector to limit the HTML content to a specific container.'
                )
                .optional(),
            removeScripts: z
                .boolean()
                .describe(
                    'Remove all script tags from the HTML (default: "true").'
                )
                .optional()
                .default(true),
            removeComments: z
                .boolean()
                .describe('Remove all HTML comments (default: "false").')
                .optional()
                .default(false),
            removeStyles: z
                .boolean()
                .describe(
                    'Remove all style tags from the HTML (default: "false").'
                )
                .optional()
                .default(false),
            removeMeta: z
                .boolean()
                .describe(
                    'Remove all meta tags from the HTML (default: "false").'
                )
                .optional()
                .default(false),
            cleanHtml: z
                .boolean()
                .describe(
                    'Perform comprehensive HTML cleaning (default: "false").'
                )
                .optional()
                .default(false),
            minify: z
                .boolean()
                .describe('Minify the HTML output (default: "false").')
                .optional()
                .default(false),
            maxLength: z
                .number()
                .int()
                .positive()
                .describe(
                    `Maximum number of characters to return (default: "${DEFAULT_MAX_HTML_LENGTH}").`
                )
                .optional()
                .default(DEFAULT_MAX_HTML_LENGTH),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {
            output: z
                .string()
                .describe('The requested HTML content of the page.'),
        };
    }

    async handle(
        context: McpSessionContext,
        args: GetAsHtmlInput
    ): Promise<GetAsHtmlOutput> {
        const {
            selector,
            removeScripts,
            removeComments,
            removeStyles,
            removeMeta,
            minify,
            cleanHtml,
            maxLength,
        } = args;

        // Get the HTML content
        let htmlContent: string;

        if (selector) {
            // If a selector is provided, get only the HTML for that element
            const element: ElementHandle | null =
                await context.page.$(selector);
            if (!element) {
                throw new Error(
                    `Element with selector "${selector}" not found`
                );
            }
            htmlContent = await element.evaluate(
                (el: Element): string => el.outerHTML
            );
        } else {
            // Otherwise get the full page HTML
            htmlContent = await context.page.content();
        }

        // Determine if we need to apply filters
        const shouldRemoveScripts: boolean = removeScripts || cleanHtml;
        const shouldRemoveComments: boolean = removeComments || cleanHtml;
        const shouldRemoveStyles: boolean = removeStyles || cleanHtml;
        const shouldRemoveMeta: boolean = removeMeta || cleanHtml;

        // Apply filters in the browser context
        if (
            shouldRemoveScripts ||
            shouldRemoveComments ||
            shouldRemoveStyles ||
            shouldRemoveMeta ||
            minify
        ) {
            htmlContent = await context.page.evaluate(
                ({
                    html,
                    removeScripts,
                    removeComments,
                    removeStyles,
                    removeMeta,
                    minify,
                }): string => {
                    // Parse as a fragment (no <html>/<body> wrapper will be added)
                    const template: HTMLTemplateElement =
                        document.createElement('template');
                    template.innerHTML = html;

                    // Work on the fragment
                    const root: DocumentFragment = template.content;

                    // Remove script tags if requested
                    if (removeScripts) {
                        const scripts: NodeListOf<HTMLScriptElement> =
                            root.querySelectorAll('script');
                        scripts.forEach((script: HTMLScriptElement): void =>
                            script.remove()
                        );
                    }

                    // Remove style tags if requested
                    if (removeStyles) {
                        const styles: NodeListOf<HTMLStyleElement> =
                            root.querySelectorAll('style');
                        styles.forEach((style: HTMLStyleElement): void =>
                            style.remove()
                        );
                    }

                    // Remove meta tags if requested
                    if (removeMeta) {
                        const metaTags: NodeListOf<HTMLMetaElement> =
                            root.querySelectorAll('meta');
                        metaTags.forEach((meta: HTMLMetaElement): void =>
                            meta.remove()
                        );
                    }

                    // Remove HTML comments if requested
                    if (removeComments) {
                        const removeComments: (node: Node) => void = (
                            node: Node
                        ): void => {
                            const childNodes: NodeListOf<ChildNode> =
                                node.childNodes;
                            for (
                                let i: number = childNodes.length - 1;
                                i >= 0;
                                i--
                            ) {
                                const child: Node = childNodes[i];
                                if (child.nodeType === 8) {
                                    // 8 is for comment nodes
                                    node.removeChild(child);
                                } else if (child.nodeType === 1) {
                                    // 1 is for element nodes
                                    removeComments(child);
                                }
                            }
                        };
                        removeComments(root);
                    }

                    // Get the processed HTML (fragment output, no <html>/<body>)
                    let result: string = template.innerHTML;

                    // Minify if requested
                    if (minify) {
                        // Simple minification: remove extra whitespace
                        result = result.replace(/>\s+</g, '><').trim();
                    }

                    return result;
                },
                {
                    html: htmlContent,
                    removeScripts: shouldRemoveScripts,
                    removeComments: shouldRemoveComments,
                    removeStyles: shouldRemoveStyles,
                    removeMeta: shouldRemoveMeta,
                    minify,
                }
            );
        }

        // Truncate logic
        let output: string = htmlContent;
        if (output.length > maxLength) {
            output =
                output.slice(0, maxLength) +
                '\n<!-- Output truncated due to size limits -->';
        }
        return {
            output,
        };
    }
}
