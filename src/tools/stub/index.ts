import { Tool } from '../types';
import { Clear } from './clear';
import { InterceptHttpRequest } from './intercept-http-request';
import { List } from './list';
import { MockHttpResponse } from './mock-http-response';

export const tools: Tool[] = [
    new Clear(),
    new InterceptHttpRequest(),
    new List(),
    new MockHttpResponse(),
];
