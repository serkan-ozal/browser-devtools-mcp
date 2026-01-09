import { Tool } from '../types';
import { WaitForNetworkIdle } from './wait-for-network-idle';

export const tools: Tool[] = [new WaitForNetworkIdle()];
