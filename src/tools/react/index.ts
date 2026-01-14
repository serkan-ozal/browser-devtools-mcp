import { Tool } from '../types';
import { GetComponentForElement } from './get-component-for-element';
import { GetElementForComponent } from './get-element-for-component';

export const tools: Tool[] = [
    new GetComponentForElement(),
    new GetElementForComponent(),
];
