import { Tool } from '../types';
import { GetConsoleMessages } from './get-console-messages';
import { GetHttpRequests } from './get-http-requests';

export const tools: Tool[] = [new GetConsoleMessages(), new GetHttpRequests()];
