import ComponentTemplate from "@/misc/ComponentTemplate";
import StellarisSave from "@/StellarisSave";
import { MyError, structuredClone } from "@/utils/common";
import { loadGameData } from "@/utils/gameData";
import { ParadoxDataEntry, ParadoxDataEntryHandle, ParadoxDataObject, ParadoxDataObjectHandle, stripSidesByCharacter } from "@/utils/paradox";

const getNewIdForNewShipDesign = (save: StellarisSave) => {
	let id = save.gamestate.$('last_created_design').value as number + 1;
	while (save.findShipDesignById(id)) {
		id += 1;
	}
	save.gamestate.$('last_created_design').value = id;
	return id;
}

export const HitpointsTypes = ['hull', 'armor', 'shield'] as const;

export class ShipDesignComponentHandle extends ParadoxDataObjectHandle {
	constructor(object: ParadoxDataObject | ParadoxDataEntryHandle) {
		super(object);
	}

	get slot() {
		return stripSidesByCharacter(this.$('slot')._ as string);
	}

	get templateKey() {
		return stripSidesByCharacter(this.$('template')._ as string);
	}
	set templateKey(value: string) {
		this.$('template')._ = `"${value}"`;
	}

	getTemplate() {
		return ComponentTemplate.getByKey(this.templateKey);
	}
}

export class ShipDesignSectionHandle extends ParadoxDataObjectHandle {
	_components: Map<string, ShipDesignComponentHandle>;
	_componentsKeys: string[];

	constructor(object: ParadoxDataObject | ParadoxDataEntryHandle) {
		super(object);
		this._components = new Map(
			this.$$('component').map(e => [
				stripSidesByCharacter(e.$('slot')._ as string),
				new ShipDesignComponentHandle(e)
			] as const)
		);
		this._componentsKeys = [...this._components.keys()];
	}

	get slot() {
		return stripSidesByCharacter(this.$('slot')._ as string);
	}

	get templateKey() {
		return stripSidesByCharacter(this.$('template')._ as string);
	}
	set templateKey(value: string) {
		this.$('template')._ = `"${value}"`;
	}

	/**
	 * Allow access section components by slot key (assuming they are unique).
	 */
	get components() {
		return new Proxy({}, {
			get: (_, key: string | Symbol) => {
				if (typeof key == 'string') {
					return this._components.get(key);
				}
				if (key === Symbol.iterator) {
					const that = this;
					return () => ({
						index: -1,
						next: function() {
							const key = that._componentsKeys[++this.index];
							return {
								done: !key,
								value: key ? that._components.get(key) : undefined,
							}
						}
					})
				}
				return undefined;
			},
			set: (_, key: string, value: ShipDesignComponentHandle | undefined) => {
				let entry = this.$$('section').find(e => e.$('slot')._ == `"${key}"`);
				if (!entry) {
					if (value) {
						const entries = this._ as ParadoxDataEntry[];
						const indexBefore = entries.findIndex(e => e[0] === 'slot');
						entries.splice(indexBefore + 1, 0, ['component', value._]);
						this._components.set(key, value);
						this._componentsKeys.push(key);
					}
				}
				else {
					entry._ = value ? value._ : undefined;
					if (value) {
						this._components.set(key, value);
					}
					else {
						this._components.delete(key);
						this._componentsKeys = this._componentsKeys.filter(a => a == key);
					}
				}
				return true;
			},
		}) as ShipDesignComponentHandle[];
	}
}

export class ShipDesignHandle extends ParadoxDataEntryHandle {
	_save: StellarisSave;
	_sections: Map<string, ShipDesignSectionHandle>;
	_sectionsKeys: string[];

	constructor(
		entry: ParadoxDataEntry | ParadoxDataEntryHandle,
		save: StellarisSave,
	) {
		super(entry);
		this._save = save;
		this._sections = new Map(
			this.$$('section').map(e => [
				stripSidesByCharacter(e.$('slot')._ as string),
				new ShipDesignSectionHandle(e)
			] as const)
		);
		this._sectionsKeys = [...this._sections.keys()];
	}

	////////////////////////////////////////////////////////////////////////////////

	get id() {
		return this.key as number;
	}

	get name() {
		const name = this.$('name').$('key')._ as string | undefined
		if (!name) return undefined;
		return stripSidesByCharacter(name);
	}
	set name(value: string | undefined) {
		this.$('name').$('key')._ = value ? `"${value}"` : undefined;
	}

	get shipSize() {
		return stripSidesByCharacter(this.$('ship_size')._ as string);
	}
	set shipSize(value: string) {
		this.$('ship_size')._ = `"${value}"`;
	}

	/**
	 * Allow access sections by slot key (assuming they are unique).
	 */
	get sections() {
		return new Proxy({}, {
			get: (_, key: string | Symbol) => {
				if (typeof key == 'string') {
					return this._sections.get(key);
				}
				if (key === Symbol.iterator) {
					const that = this;
					return () => ({
						index: -1,
						next: function() {
							const key = that._sectionsKeys[++this.index];
							return {
								done: !key,
								value: key ? that._sections.get(key) : undefined,
							}
						}
					})
				}
				return undefined;
			},
			set: (_, key: string, value: ShipDesignSectionHandle | undefined) => {
				let entry = this.$$('section').find(e => e.$('slot')._ == `"${key}"`);
				if (!entry) {
					if (value) {
						const entries = this._ as ParadoxDataEntry[];
						const indexBefore = entries.findIndex(e => e[0] === 'ship_size');
						entries.splice(indexBefore + 1, 0, ['section', value._]);
						this._sections.set(key, value);
						this._sectionsKeys.push(key);
					}
				}
				else {
					entry._ = value ? value._ : undefined;
					if (value) {
						this._sections.set(key, value);
					}
					else {
						this._sections.delete(key);
						this._sectionsKeys = this._sectionsKeys.filter(a => a == key);
					}
				}
				return true;
			},
		}) as ShipDesignSectionHandle[];
	}

	get requiredComponents(): ReadonlyArray<string> {
		return this.$$('required_component')
			.map(e => stripSidesByCharacter(e._ as string))
		;
	}
	set requiredComponents(array: ReadonlyArray<string>) {
		this.removeSubentriesByKey('required_component');
		this.valueAsObject().push(...array.map(s => ['required_component', s] as const));
	}

	async calculateMaxHitpoints() {
		const shipSizes = await loadGameData('common/ship_sizes/*');
		const shipSizeEntry = shipSizes.find(e => e[0] == this.shipSize);
		if (!shipSizeEntry) {
			throw new MyError('game-data/ship-design/missing-ship-size', `Ship size '${this.shipSize}'' from Ship Design ID ${this.id} not found in game data`);
		}
		const shipSize = new ParadoxDataEntryHandle(shipSizeEntry);

		let maxHitpoints = {
			hull: shipSize.$('max_hitpoints').value as number,
			shield: 0,
			armor: 0,
		};
		let maxHitpointsMultipliers = {
			hull: 0,
			shield: 0,
			armor: 0,
		};

		for (const section of this.sections) {
			for (const component of section.components) {
				const template = await ComponentTemplate.getByKey(component.templateKey);
				const modifiers = template.$('modifier');
				for (const type of HitpointsTypes) {
					const flat = modifiers.$(`ship_${type}_add`).value as number | undefined;
					if (flat) {
						maxHitpoints[type] += flat;
					}
					const mult = modifiers.$(`ship_${type}_mult`).value as number | undefined;
					if (mult) {
						maxHitpointsMultipliers[type] += mult;
					}
				}
			}
		}

		// TODO: check `required_component`s too? 
		// In base game/DLCs there seems to be no hitpoints modifiers there,
		// but I guess there could. 

		// TODO: auras active boosting shields?
		// TODO: system modifiers
		// TODO: country modifiers (events, technology, edicts, ...)

		for (const type of HitpointsTypes) {
			maxHitpoints[type] += maxHitpointsMultipliers[type] * maxHitpoints[type];
		}
		return maxHitpoints;
	}

	////////////////////////////////////////////////////////////////////////////////

	/**
	 * Copies ship design entry and returns the handle to the copy.
	 * @param save Save instance to copy the design to, for default, uses 
	 * the one associated with the design in the first place.
	 */
	copy(save?: StellarisSave) {
		save ||= this._save;
		const acrossSaves = this._save == save;

		const id = getNewIdForNewShipDesign(save);
		console.debug(`Copying ship design ID ${this.id} as new ID ${this.id} ${acrossSaves ? 'across saves ' : ''}`);

		const entry = structuredClone(this._entry);
		entry[0] = id;
		const handle = new ShipDesignHandle(entry, save);

		save.shipDesigns.push(handle);
		save.gamestate.$('ship_design').valueAsObject().push(entry);

		return handle;
	}
}

export default ShipDesignHandle;
