import { ParadoxDataObject, ParadoxDataObjectHandle } from "@/utils/paradox";

export class SpeciesHandle extends ParadoxDataObjectHandle {
	readonly index: number;

	constructor(
		entry: ParadoxDataObject | ParadoxDataObjectHandle,
		index: number = -1,
	) {
		super(entry instanceof ParadoxDataObjectHandle ? entry._object : entry);
		this.index = index;
	}

	get name() {
		return this.$('name')._ as string;
	}
	set name(value: string) {
		this.$('name')._ = value;
	}

	get plural() {
		return this.$('plural')._ as string;
	}
	set plural(value: string) {
		this.$('plural')._ = value;
	}

	get nameList() {
		return this.$('name_list')._ as string;
	}
	set nameList(value: string) {
		this.$('name_list')._ = value;
	}

	get adjective() {
		return this.$('adjective')._ as string;
	}
	set adjective(value: string) {
		this.$('adjective')._ = value;
	}	

	get class() {
		return this.$('class')._ as string;
	}
	set class(value: string) {
		this.$('class')._ = value;
	}

	get portrait() {
		return this.$('portrait')._ as string;
	}
	set portrait(value: string) {
		this.$('portrait')._ = value;
	}

	get traits() {
		const a = this.$('traits')._ as ParadoxDataObject;
		const proxy = {
			add: (trait: string) => {
				const i = a.findIndex(e => e[1] == `"${trait}"`);
				if (i === -1) {
					a.push(['trait', `"${trait}"`]);
				}
				return proxy;
			},
			remove: (trait: string) => {
				const i = a.findIndex(e => e[1] == `"${trait}"`);
				if (i !== -1) {
					a.splice(i, 1);
				}
				return proxy;
			},
			toArray: () => {
				return a.map(e => (e[1] as string).substring(1, (e[1] as string).length - 1));
			}
		};
		return proxy;
	}
}

export default SpeciesHandle;
