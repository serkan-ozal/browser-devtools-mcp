import { ToolSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';

import { z } from 'zod';

const DEFAULT_TIMEOUT_MS: number = 30_000;
const DEFAULT_IDLE_TIME_MS: number = 500;
const DEFAULT_MAX_CONNECTIONS: number = 0;
const DEFAULT_POLL_INTERVAL_MS: number = 50;

export interface WaitForNetworkIdleInput extends ToolInput {
    timeoutMs?: number;
    idleTimeMs?: number;
    maxConnections?: number;
    pollIntervalMs?: number;
}

export interface WaitForNetworkIdleOutput extends ToolOutput {
    waitedMs: number;
    idleTimeMs: number;
    timeoutMs: number;
    maxConnections: number;
    pollIntervalMs: number;
    finalInFlightRequests: number;
    observedIdleMs: number;
}

export class WaitForNetworkIdle implements Tool {
    name(): string {
        return 'sync_wait-for-network-idle';
    }

    description(): string {
        return `
Waits until the page reaches a network-idle condition based on the session's tracked in-flight request count.

Definition:
- "Idle" means the number of in-flight requests is <= maxConnections
- and it stays that way continuously for at least idleTimeMs.

When to use:
- Before interacting with SPA pages that load data asynchronously
- Before taking screenshots / AX tree snapshots for more stable results
- After actions that trigger background fetch/XHR activity

Notes:
- This tool does NOT rely on window globals or page-injected counters.
- It uses server-side tracking, so it works reliably even with strict CSP.
- If the page has long-polling or never-ending requests, increase maxConnections or accept a shorter idleTimeMs.
        `.trim();
    }

    inputSchema(): ToolInputSchema {
        return {
            timeoutMs: z
                .number()
                .int()
                .min(0)
                .optional()
                .default(DEFAULT_TIMEOUT_MS)
                .describe(
                    'Maximum time to wait before failing (milliseconds)..'
                ),
            idleTimeMs: z
                .number()
                .int()
                .min(0)
                .optional()
                .default(DEFAULT_IDLE_TIME_MS)
                .describe(
                    'How long the network must stay idle continuously before resolving (milliseconds).'
                ),
            maxConnections: z
                .number()
                .int()
                .min(0)
                .optional()
                .default(DEFAULT_MAX_CONNECTIONS)
                .describe(
                    'Idle threshold. Network is considered idle when in-flight requests <= maxConnections.'
                ),
            pollIntervalMs: z
                .number()
                .int()
                .min(10)
                .optional()
                .default(DEFAULT_POLL_INTERVAL_MS)
                .describe(
                    'Polling interval used to sample the in-flight request count (milliseconds).'
                ),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {
            waitedMs: z
                .number()
                .int()
                .nonnegative()
                .describe(
                    'Total time waited until the network became idle or the tool timed out (milliseconds).'
                ),
            idleTimeMs: z
                .number()
                .int()
                .nonnegative()
                .describe('Idle duration required for success (milliseconds).'),
            timeoutMs: z
                .number()
                .int()
                .nonnegative()
                .describe('Maximum allowed wait time (milliseconds).'),
            maxConnections: z
                .number()
                .int()
                .nonnegative()
                .describe(
                    'Idle threshold used: in-flight requests must be <= this value.'
                ),
            pollIntervalMs: z
                .number()
                .int()
                .nonnegative()
                .describe(
                    'Polling interval used to sample the in-flight request count (milliseconds).'
                ),
            finalInFlightRequests: z
                .number()
                .int()
                .nonnegative()
                .describe(
                    'The last observed number of in-flight requests at the moment the tool returned.'
                ),
            observedIdleMs: z
                .number()
                .int()
                .nonnegative()
                .describe(
                    'How long the in-flight request count stayed <= maxConnections right before returning (milliseconds).'
                ),
        };
    }

    async handle(
        context: ToolSessionContext,
        args: WaitForNetworkIdleInput
    ): Promise<WaitForNetworkIdleOutput> {
        const timeoutMs: number = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        const idleTimeMs: number = args.idleTimeMs ?? DEFAULT_IDLE_TIME_MS;
        const maxConnections: number =
            args.maxConnections ?? DEFAULT_MAX_CONNECTIONS;
        const pollIntervalMs: number =
            args.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

        const startMs: number = Date.now();
        const deadlineMs: number = startMs + timeoutMs;

        // The time when we last observed "not idle" (inFlight > maxConnections).
        // If we never see "not idle", this will stay at startMs and the tool will
        // resolve after idleTimeMs.
        let lastNotIdleMs: number = startMs;

        // Track last observed in-flight count for output/debuggability.
        let lastInFlight: number = 0;

        while (true) {
            const nowMs: number = Date.now();

            lastInFlight = context.numOfInFlightRequests();

            // If network is not idle, reset the idle window.
            if (lastInFlight > maxConnections) {
                lastNotIdleMs = nowMs;
            }

            const observedIdleMs: number = nowMs - lastNotIdleMs;

            // Success: continuously idle for required duration.
            if (observedIdleMs >= idleTimeMs) {
                const waitedMs: number = nowMs - startMs;

                return {
                    waitedMs,
                    idleTimeMs,
                    timeoutMs,
                    maxConnections,
                    pollIntervalMs,
                    finalInFlightRequests: lastInFlight,
                    observedIdleMs,
                };
            }

            // Timeout check
            if (nowMs >= deadlineMs) {
                const waitedMs: number = nowMs - startMs;
                throw new Error(
                    `Timed out after ${waitedMs}ms waiting for network idle (idleTimeMs=${idleTimeMs}, maxConnections=${maxConnections}, inFlight=${lastInFlight}).`
                );
            }

            await this.sleep(pollIntervalMs);
        }
    }

    private async sleep(ms: number): Promise<void> {
        await new Promise((resolve: (value: void) => void): void => {
            setTimeout((): void => resolve(), ms);
        });
    }
}
