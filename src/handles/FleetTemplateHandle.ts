import StellarisSave from "@/StellarisSave";
import { structuredClone } from "@/utils/common";
import { ParadoxDataEntry, ParadoxDataEntryHandle, ParadoxDataObject } from "@/utils/paradox";
import { CoordsHandle } from "./CoordsHandle"
import CountryHandle from "./CountryHandle";
import FleetHandle from "./FleetHandle";
import ShipDesignHandle from "./ShipDesignHandle";

const getNewIdForNewFleetTemplate = (save: StellarisSave) => {
	// Note: there seems to be no `last_created_fleet_template`
	let id = save.fleetTemplates[save.fleetTemplates.length - 1]!.id || 16777216;
	while (save.findFleetTemplateById(id)) {
		id += 1;
	}
	return id;
}

interface CompositionEntry {
	designId: number;
	count: number;
}

export class FleetTemplateHandle extends ParadoxDataEntryHandle {
	_save: StellarisSave;

	constructor(
		entry: ParadoxDataEntry | ParadoxDataEntryHandle,
		save: StellarisSave,
	) {
		super(entry);
		this._save = save;
	}

	get id() {
		return this.key as number;
	}

	////////////////////////////////////////////////////////////////////////////////

	get fleetId() {
		return this.$('fleet')._ as number | undefined;
	}
	getFleet() {
		return this.fleetId == undefined ? undefined : this._save.getFleetById(this.fleetId);
	}
	setFleet(idOrHandle: number | FleetHandle | undefined) {
		const id = idOrHandle instanceof FleetHandle ? idOrHandle.id : idOrHandle;
		this.$('fleet').value = id;
	}

	get composition(): ReadonlyArray<CompositionEntry> {
		return this.$('fleet_template_design').$$().map(e => ({
			designId: e.$('design').value as number,
			count: (e.$('count').value as number | undefined) || 1,
		}) as CompositionEntry)
	}

	printCompositionAsString() {
		let contents: string[] = [];
		for (const entry of this.composition) {
			const design = this._save.getShipDesignById(entry.designId);
			contents.push(`${entry.count}x ${design.name} (${design.shipSize} #${design.id})`);
		}
		return contents.join(', ');
	}

	get designsIds(): ReadonlyArray<number> {
		return this.composition.map(e => e.designId);
	}
	get designs(): ReadonlyArray<ShipDesignHandle> {
		return this.designsIds.map(id => this._save.getShipDesignById(id));
	}

	addDesign(idOrHandle: number | ShipDesignHandle, count: number = 1) {
		const id = idOrHandle instanceof ShipDesignHandle ? idOrHandle.id : idOrHandle;
		const entry = this.$('fleet_template_design').$$().find(e => e.$('design').value == id);
		if (entry) {
			entry.$('count').value = ((entry.$('count').value as number | undefined) || 1) + count;
		}
		else {
			this.$('fleet_template_design').valueAsObject().push([null, [
				['design', id],
				['count', count],
			]]);
		}
	}

	removeDesign(idOrHandle: number | ShipDesignHandle, count: number = Infinity) {
		const id = idOrHandle instanceof ShipDesignHandle ? idOrHandle.id : idOrHandle;
		const entry = this.$('fleet_template_design').$$().find(e => e.$('design').value == id);
		if (entry) {
			const newCount = ((entry.$('count').value as number | undefined) || 1) - count;
			if (newCount < 0) {
				const array = this.$('fleet_template_design').valueAsObject();
				const index = array.indexOf(entry._entry);
				if (index !== -1) {
					array.splice(index, 1);
				}
			}
			else {
				entry.$('count').value = newCount;
			}
		}
	}

	// TODO: add `updateFleet` to `addDesign`/`removeDesign`?

	// TODO: 'all_queued' 

	async updateCountAndFleetSize() {
		let count = 0;
		// let fleetSize = 0;
		for (const entry of this.composition) {
			count += entry.count;
			// TODO: fleet size?
		}
		this.$('count').value = count;
		// this.$('fleet_size').value = fleetSize;
	}

	/**
	 * Copies fleet template, optionally (if coords provided) creates related
	 * fleet and ships to fill the design. Possibly across saves.
	 * @param country Country that will be owner of the fleet design. 
	 * @param coords Coords for whereabout of new fleet. If not provided, 
	 * fleet will be not created.
	 * @param name Name of fleet, if none provided, ID will be used.
	 */
	async copy(
		country: CountryHandle,
		coords?: CoordsHandle | undefined,
		name?: string,
	) {
		const save = country._save;
		const acrossSaves = this._save == save;
		const id = getNewIdForNewFleetTemplate(save);

		console.debug(`Copying fleet template ID ${this.id} as new ID ${this.id} ${acrossSaves ? 'across saves ' : ''}${coords ? 'with fleet ' : ''}`);

		if (acrossSaves) {
			// TODO: copy designs, maybe try avoid repetitions?
			for (const design of this.designs) {
				design.copy(save);
			}
		}

		const entry = structuredClone(this._entry);
		entry[0] = id;
		// TODO: drop all 'all_queued'?
		const template = new FleetTemplateHandle(entry, save);

		if (coords) {
			template.setFleet(await FleetHandle.newFromTemplate(template, country, coords, name));
		}
		else {
			template.setFleet(undefined);
		}

		save.fleetTemplates.push(template);
		save.gamestate.$('fleet_template').valueAsObject().push(entry);

		return template;
	}

	/**
	 * Creates new fleet template for selected country, optionally (if 
	 * coords provided) creates related fleet and ships to fill the design.
	 * @param country Country that will be owner of the fleet design.
	 * @param composition Array defining design composition, pairs of 
	 * ship designs and count.
	 * @param coords Coords for whereabout of new fleet. If not provided, 
	 * fleet will be not created.
	 * @param name Name of fleet, if none provided, ID will be used.
	 */
	static async new(
		country: CountryHandle,
		composition: CompositionEntry[], 
		coords?: CoordsHandle | undefined,
		name?: string,
	) {
		const save = country._save;
		const id = getNewIdForNewFleetTemplate(save);
		console.debug(`Adding new fleet template ID ${id} ${coords ? 'with fleet ' : ''}for country ID ${country.id}`);

		country.registerFleetTemplate(id);

		const object: ParadoxDataObject = [
			['fleet_template_design', []],
			['all_queued', []],
		]
		const entry: ParadoxDataEntry = [id, object];
		const template = new FleetTemplateHandle(entry, save);

		for (const entry of composition) {
			template.addDesign(entry.designId, entry.count);
		}
		await template.updateCountAndFleetSize();

		if (coords) {
			template.setFleet(await FleetHandle.newFromTemplate(template, country, coords, name));
		}

		save.fleetTemplates.push(template);
		save.gamestate.$('fleet_template').valueAsObject().push(entry);

		return template;
	}
}

export default FleetTemplateHandle;
