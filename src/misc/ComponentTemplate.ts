import { MyError } from "@/utils/common";
import { loadGameData } from "@/utils/gameData";
import { ParadoxDataEntryHandle, ParadoxDataObject, ParadoxDataObjectHandle, stripSidesByCharacter } from "@/utils/paradox";

// TODO: add classes subtypes? 'utility_component_template', 'weapon_component_template', 'strike_craft_component_template', ...

export const ComponentTypes = ['utility', 'weapon', 'strike_craft'] as const;
export type ComponentType = typeof ComponentTypes[number];

export class ComponentTemplate extends ParadoxDataObjectHandle {
	static _cache = new Map<string, ComponentTemplate>();
	
	type: ComponentType;

	constructor(
		entry: ParadoxDataObject | ParadoxDataObjectHandle | ParadoxDataEntryHandle, 
		type: ComponentType,
	) {
		super(entry);
		this.type = type;
	}

	get key() {
		return stripSidesByCharacter(this.$('key').value as string);
	}

	static tryGetType(entryKey: string | number | null) {
		if (typeof entryKey == 'string') {
			return entryKey.substring(0, entryKey.indexOf('_component_template')) as ComponentType;
		}
		return undefined;
	}

	static async loadFromGameData() {
		const entries = await loadGameData('common/component_templates/*');
		for (const entry of entries) {
			const type = this.tryGetType(entry[0]);
			if (type) {
				const handle = new ComponentTemplate(entry[1] as ParadoxDataObject, type);
				this._cache.set(handle.key, handle);
			}
		}
	}

	static async getAll() {
		if (this._cache.size == 0) {
			console.debug('Loading default components templates from game data...');
			await this.loadFromGameData();
		}
		return this._cache;
	}

	/**
	 * Finds component template from game data.
	 */
	static async findByKey(key: string) {
		return (await this.getAll()).get(key);
	}

	/**
	 * Get component template from game data.
	 * If not found, throws.
	 */
	static async getByKey(key: string) {
		const thing = await this.findByKey(key);
		if (!thing) {
			throw new MyError('game-data/component-template-not-found', `Component template not found by key '${key}'`);
		}
		return thing;
	}
}

export default ComponentTemplate;
