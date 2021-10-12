import { ParadoxDataEntry, ParadoxDataEntryHandle, ParadoxDataObject, ParadoxDataObjectHandle, stripSidesByCharacter } from "@/utils/paradox";

export class ShipDesignComponentHandle extends ParadoxDataObjectHandle {
	constructor(object: ParadoxDataObject | ParadoxDataEntryHandle) {
		super(object);
	}

	get slot() {
		return stripSidesByCharacter(this.$('slot')._ as string);
	}

	get template() {
		return stripSidesByCharacter(this.$('template')._ as string);
	}
	set template(value: string) {
		this.$('template')._ = `"${value}"`;
	}
}

export class ShipDesignSectionHandle extends ParadoxDataObjectHandle {
	constructor(object: ParadoxDataObject | ParadoxDataEntryHandle) {
		super(object);
	}

	get slot() {
		return stripSidesByCharacter(this.$('slot')._ as string);
	}

	get template() {
		return stripSidesByCharacter(this.$('template')._ as string);
	}
	set template(value: string) {
		this.$('template')._ = `"${value}"`;
	}

	/**
	 * Allow access section components by slot key (assuming they are unique).
	 */
	get components() {
		return new Proxy({}, {
			get: (_, key: string) => {
				const entry = this.$$('section').find(e => e.$('slot')._ == `"${key}"`);
				return entry ? new ShipDesignComponentHandle(entry) : undefined;
			},
			set: (_, key: string, value: ShipDesignComponentHandle | undefined) => {
				let entry = this.$$('section').find(e => e.$('slot')._ == `"${key}"`);
				if (!entry) {
					if (value) {
						const entries = this._ as ParadoxDataEntry[];
						const slotEntryIndex = entries.findIndex(e => e[0] === 'slot');
						entries.splice(slotEntryIndex, 0, ['section', value._]);
					}
				}
				else {
					entry._ = value ? value._ : undefined;
				}
				return true;
			},
		}) as (ShipDesignComponentHandle | undefined)[];
	}
}

export class ShipDesignHandle extends ParadoxDataEntryHandle {
	constructor(
		entry: ParadoxDataEntry | ParadoxDataEntryHandle
	) {
		super(entry instanceof ParadoxDataEntryHandle ? entry._entry : entry);
	}

	get id() {
		return this.key as number;
	}

	get name() {
		return stripSidesByCharacter(this.$('name')._ as string);
	}
	set name(value: string) {
		this.$('name')._ = `"${value}"`;
	}

	get shipSize() {
		return stripSidesByCharacter(this.$('shipSize')._ as string);
	}
	set shipSize(value: string) {
		this.$('shipSize')._ = `"${value}"`;
	}

	/**
	 * Allow access sections by slot key (assuming they are unique).
	 */
	get sections() {
		return new Proxy({}, {
			get: (_, key: string) => {
				const entry = this.$$('section').find(e => e.$('slot')._ == `"${key}"`);
				return entry ? new ShipDesignSectionHandle(entry) : undefined;
			},
			set: (_, key: string, value: ShipDesignSectionHandle | undefined) => {
				let entry = this.$$('section').find(e => e.$('slot')._ == `"${key}"`);
				if (!entry) {
					if (value) {
						const entries = this._ as ParadoxDataEntry[];
						const slotEntryIndex = entries.findIndex(e => e[0] === 'slot');
						entries.splice(slotEntryIndex, 0, ['section', value._]);
					}
				}
				else {
					entry._ = value ? value._ : undefined;
				}
				return true;
			},
		}) as (ShipDesignSectionHandle | undefined)[];
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
}

export default ShipDesignHandle;
