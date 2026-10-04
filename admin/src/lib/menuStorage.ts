import type { MenuItem } from '../types';

export const MENU_STORAGE_KEYS = {
  customItems: 'bb_custom_menu_items',
  deletedIds: 'bb_deleted_menu_ids'
} as const;

export function getCustomMenuItems(): MenuItem[] {
  try {
    const raw = localStorage.getItem(MENU_STORAGE_KEYS.customItems);
    if (!raw) return [];
    return JSON.parse(raw) as MenuItem[];
  } catch {
    return [];
  }
}

export function getDeletedMenuItemIds(): number[] {
  try {
    const raw = localStorage.getItem(MENU_STORAGE_KEYS.deletedIds);
    if (!raw) return [];
    return JSON.parse(raw) as number[];
  } catch {
    return [];
  }
}

export function saveCustomMenuItem(item: MenuItem): void {
  try {
    const items = getCustomMenuItems();
    const index = items.findIndex(
      (i) => i.id === item.id || (i.name && item.name && i.name.toLowerCase().trim() === item.name.toLowerCase().trim())
    );
    if (index >= 0) {
      items[index] = { ...items[index], ...item };
    } else {
      items.push(item);
    }
    localStorage.setItem(MENU_STORAGE_KEYS.customItems, JSON.stringify(items));

    // Remove from deleted list if it was re-added
    const deleted = getDeletedMenuItemIds().filter((id) => id !== item.id);
    localStorage.setItem(MENU_STORAGE_KEYS.deletedIds, JSON.stringify(deleted));
  } catch (e) {
    console.warn('Failed to save custom menu item to localStorage:', e);
  }
}

export function removeCustomMenuItem(id: number): void {
  try {
    const items = getCustomMenuItems().filter((i) => i.id !== id);
    localStorage.setItem(MENU_STORAGE_KEYS.customItems, JSON.stringify(items));

    const deleted = getDeletedMenuItemIds();
    if (!deleted.includes(id)) {
      deleted.push(id);
      localStorage.setItem(MENU_STORAGE_KEYS.deletedIds, JSON.stringify(deleted));
    }
  } catch (e) {
    console.warn('Failed to remove custom menu item from localStorage:', e);
  }
}

export function hydrateAndMergeMenuItems(defaultOrServerItems: MenuItem[] = []): MenuItem[] {
  const customItems = getCustomMenuItems();
  const deletedIds = getDeletedMenuItemIds();

  // 1. Filter out deleted IDs from default/server items
  const validDefaults = (defaultOrServerItems || []).filter((item) => !deletedIds.includes(item.id));

  // 2. Map server items by ID and by normalized name
  const itemMap = new Map<number, MenuItem>();
  const nameToIdMap = new Map<string, number>();

  for (const item of validDefaults) {
    itemMap.set(item.id, item);
    if (item.name) {
      nameToIdMap.set(item.name.toLowerCase().trim(), item.id);
    }
  }

  // 3. Merge custom items (linking to server DB ID if name matches)
  for (const customItem of customItems) {
    if (deletedIds.includes(customItem.id)) continue;

    const matchedServerId = itemMap.has(customItem.id)
      ? customItem.id
      : customItem.name
      ? nameToIdMap.get(customItem.name.toLowerCase().trim())
      : undefined;

    if (matchedServerId !== undefined) {
      const existing = itemMap.get(matchedServerId)!;
      itemMap.set(matchedServerId, { ...existing, ...customItem, id: matchedServerId });
    } else {
      itemMap.set(customItem.id, customItem);
    }
  }

  return Array.from(itemMap.values());
}
