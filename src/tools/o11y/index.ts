import { Tool } from '../types';
import { GetConsoleMessages } from './get-console-messages';
import { GetHttpRequests } from './get-http-requests';
import { GetTraceId } from './get-trace-id';
import { NewTraceId } from './new-trace-id';
import { SetTraceId } from './set-trace-id';

export const tools: Tool[] = [
    new GetConsoleMessages(),
    new GetHttpRequests(),
    new GetTraceId(),
    new NewTraceId(),
    new SetTraceId(),
];
