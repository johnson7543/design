import { treeDesignAdapter } from './tree/adapter.ts';

export const designRegistry = {
  tree: treeDesignAdapter,
} as const;

export type DesignRegistry = typeof designRegistry;
export type RegisteredDesignName = keyof DesignRegistry;

export function getDesignAdapter(name: string) {
  return name === 'tree' ? designRegistry.tree : undefined;
}
