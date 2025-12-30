import { Tool } from '../types';
import { GoBack } from './go-back';
import { GoForward } from './go-forward';
import { GoTo } from './go-to';

export const tools: Tool[] = [new GoBack(), new GoForward(), new GoTo()];
