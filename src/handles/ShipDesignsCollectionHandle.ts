import { ParadoxDataEntry, ParadoxDataEntryHandle } from "@/utils/paradox";
import StellarisSave from "@/StellarisSave";
import ShipDesignHandle from "./ShipDesignHandle";

export class ShipDesignsCollectionHandle extends ParadoxDataEntryHandle {
	_save: StellarisSave;
	handles: ShipDesignHandle[];

	constructor(
		entry: ParadoxDataEntry | ParadoxDataEntryHandle,
		save: StellarisSave,
	) {
		super(entry instanceof ParadoxDataEntryHandle ? entry._entry : entry);
		this._save = save;

		this.handles = this.$('ship_design').$$()
			.map(e => this._save.findShipDesignById(e._ as number))
			.filter(handle => {
				if (handle) {
					return true;
				}
				else {
					console.warn('Ship design with ID ${} not found, but listed by ships designs collection');
					return false;
				}
			}) as ShipDesignHandle[]
		;
	}

	////////////////////////////////////////////////////////////////////////////////

	get autoGeneration() {
		return this.$('auto_gen_design')._ === 'yes';
	}
	set autoGeneration(value: boolean) {
		this.$('auto_gen_design')._ = value ? 'yes' : 'no';
	}

	findById(id: number) {
		return this.handles.find(h => h.id === id);
	}

	findByName(name: string) {
		return this.handles.find(h => h.name.toLowerCase() === name.toLowerCase());
	}
}

export default ShipDesignsCollectionHandle;
