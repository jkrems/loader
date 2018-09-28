import { double } from './cyclic-other.js';

export function getNumber() {
  return 21;
}

export default function useCycle() {
  return double();
};

console.log('useCycle()', useCycle());
