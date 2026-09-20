import { EquipmentState } from "./equipmentSystem";
import { ItemStats } from "./types";

export function equipmentBonuses(equipment: EquipmentState) {
  return Object.values(equipment).reduce<ItemStats>((bonuses, item) => {
    if (!item || !item.stats) return bonuses;
    for (const [key, value] of Object.entries(item.stats)) {
      bonuses[key] = (bonuses[key] ?? 0) + value;
    }
    return bonuses;
  }, {});
}

export function applyEquipmentStats<T extends { hp: number; maxHp: number; mana: number; maxMana: number; attack: number; defense: number; critChance: number; critDamage: number; moveSpeed: number; attackSpeed: number; skillPower: number; armor: number; luck: number }>(stats: T, equipment: EquipmentState) {
  const bonuses = equipmentBonuses(equipment);
  const maxHp = stats.maxHp + (bonuses.hp ?? 0);
  const maxMana = stats.maxMana + (bonuses.mp ?? 0);
  return {
    ...stats,
    maxHp,
    maxMana,
    attack: stats.attack + (bonuses.attack ?? 0),
    defense: stats.defense + (bonuses.defense ?? 0),
    critChance: stats.critChance + (bonuses.critChance ?? 0),
    critDamage: stats.critDamage + (bonuses.critDamage ?? 0),
    moveSpeed: stats.moveSpeed + (bonuses.moveSpeed ?? 0),
    attackSpeed: stats.attackSpeed + (bonuses.attackSpeed ?? 0),
    skillPower: stats.skillPower + (bonuses.skillPower ?? 0),
    armor: stats.armor + (bonuses.armor ?? 0),
    luck: stats.luck + (bonuses.luck ?? 0),
    hp: Math.min(stats.hp + (bonuses.hp ?? 0), maxHp),
    mana: Math.min(stats.mana + (bonuses.mp ?? 0), maxMana),
  };
}

export function applyConsumableStats<T extends { hp: number; maxHp: number; mana: number; maxMana: number; moveSpeed: number }>(stats: T, itemStats: ItemStats) {
  const safeStats = itemStats ?? {};
  return {
    ...stats,
    hp: Math.min(stats.hp + (safeStats.hp ?? 0), stats.maxHp),
    mana: Math.min(stats.mana + (safeStats.mp ?? 0), stats.maxMana),
    moveSpeed: stats.moveSpeed + (safeStats.moveSpeed ?? 0),
  };
}
