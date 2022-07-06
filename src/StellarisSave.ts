import fs from 'fs/promises';
import path from 'path';
import { ParadoxDataEntry, ParadoxDataHelper, ParadoxDataObject, ParadoxDataObjectHandle, stripSidesByCharacter } from "./utils/paradox";
import { MyError, ParserError } from './utils/common';
import { getSafeTemporaryDirectory, packTemporaryFilesIntoSave, unpackSaveIntoTemporaryFiles } from './utils/packing';
import SystemHandle, { precursorsFlags } from './handles/SystemHandle';
import SpeciesHandle from './handles/SpeciesHandle';
import CoordsPair, { isCoordsPair } from './handles/CoordsHandle';
import PlanetHandle from './handles/PlanetHandle';
import NebulaHandle from './handles/NebulaHandle';
import LeaderHandle from './handles/LeaderHandle';
import CountryHandle from './handles/CountryHandle';
import ShipDesignHandle from './handles/ShipDesignHandle';
import ShipHandle from './handles/ShipHandle';
import FleetHandle from './handles/FleetHandle';
import ArmyHandle from './handles/ArmyHandle';
import SectorHandle from './handles/SectorHandle';
import FleetTemplateHandle from './handles/FleetTemplateHandle';

export class StellarisSave {
	/**
	 * Path to temporary directory used in save unpacking and packing process.
	 */
	_tempDir: string | undefined;

	meta: ParadoxDataObjectHandle;
	gamestate: ParadoxDataObjectHandle;

	nebulas: NebulaHandle[];
	systems: SystemHandle[];
	planets: PlanetHandle[];
	species: SpeciesHandle[];
	leaders: LeaderHandle[];
	countries: CountryHandle[];
	shipDesigns: ShipDesignHandle[];
	ships: ShipHandle[];
	fleets: FleetHandle[];
	fleetTemplates: FleetTemplateHandle[];
	armies: ArmyHandle[];
	sectors: SectorHandle[];
	// TODO: refactor those handle into maps (id/index -> handle) instead lists?

	constructor(
		meta: ParadoxDataEntry[],
		gamestate: ParadoxDataEntry[]
	) {
		this.meta = new ParadoxDataObjectHandle(meta);
		this.gamestate = new ParadoxDataObjectHandle(gamestate);

		this.nebulas = this.gamestate.$$('nebula')
			.filter(e => e.value != 'none')
			.map(e => new NebulaHandle(e, this))
		;
		this.systems = this.gamestate.$('galactic_object').$$()
			.filter(e => e.value != 'none')
			.map(e => new SystemHandle(e, this))
		;
		this.planets = this.gamestate.$('planets').$('planet').$$()
			.filter(e => e.value != 'none')
			.map(e => new PlanetHandle(e, this))
		;
		this.species = (this.gamestate.$('species_db')._ as ParadoxDataObject)
			.map((e, i) => new SpeciesHandle(e[1] as ParadoxDataObject, i))
		;
		this.leaders = this.gamestate.$('leaders').$$()
			.filter(e => e.value != 'none')
			.map(e => new LeaderHandle(e, this))
		;
		this.countries = this.gamestate.$('country').$$()
			.filter(e => e.value != 'none')
			.map(e => new CountryHandle(e, this))
		;
		this.shipDesigns = this.gamestate.$('ship_design').$$()
			.map(e => new ShipDesignHandle(e, this))
		;
		this.ships = this.gamestate.$('ships').$$()
			.filter(e => e.value != 'none')
			.map(e => new ShipHandle(e, this))
		;
		this.fleets = this.gamestate.$('fleet').$$()
			.filter(e => e.value != 'none')
			.map(e => new FleetHandle(e, this))
		;
		this.fleetTemplates = this.gamestate.$('fleet_template').$$()
			.filter(e => e.value != 'none')
			.map(e => new FleetTemplateHandle(e, this))
		;
		this.armies = this.gamestate.$('army').$$()
			.filter(e => e.value != 'none')
			.map(e => new ArmyHandle(e, this))
		;
		this.sectors = this.gamestate.$('sectors').$$()
			.filter(e => e.value != 'none')
			.map(e => new SectorHandle(e, this))
		;
		// TODO: add filtering for invalid values (i.e. 'none') where necessary

		// Since around 3.3, the `country > fleet_template_manager > fleet_template` 
		// seems to contain non-existing values sometimes. Let's delete those.
		for (const country of this.countries) {
			const handle = country.$('fleet_template_manager').$('fleet_template');
			handle._ = handle.valueAsObject().filter(e => typeof e[1] == 'number' && this.findFleetTemplateById(e[1]));
		}
	}

	/**
	 * Loads saved game file.
	 * @param saveFilePath Path to save file to load.
	 * @param reportProgress Function to report progress (`step` out of `maxSteps`).
	 * @param reportMessage Function to update message (associated with progress).
	 * @returns `StellarisSave` object ready to work with.
	 */
	static async loadFromFile(
		saveFilePath: string, 
		reportProgress?: (step: number, maxSteps: number) => void, 
		reportMessage?: (message: string) => void
	) {
		if (reportProgress) {
			reportProgress(0, Infinity);
		}
		if (reportMessage) {
			reportMessage(`Decompressing save file...`);
		}
		const tempDir = await unpackSaveIntoTemporaryFiles(saveFilePath);
		
		if (reportMessage) {
			reportMessage(`Reading gamestate and meta files...`);
		}
		const metaFile = path.join(tempDir, 'meta');
		const gamestateFile = path.join(tempDir, 'gamestate');
		console.debug(`'meta' file path: ${metaFile}`);
		console.debug(`'gamestate' file path: ${gamestateFile}`);
		const metaString = await fs.readFile(metaFile, 'utf-8');
		const gamestateString = await fs.readFile(gamestateFile, 'utf-8');

		if (reportMessage) {
			reportMessage(`Parsing gamestate and meta...`);
		}
		const report = reportProgress ? (offset: number) => reportProgress(offset, gamestateString.length) : undefined;
		let metaParsed: ParadoxDataEntry[];
		let gamestateParsed: ParadoxDataEntry[];
		try {
			metaParsed = ParadoxDataHelper.loadFromString(metaString);
		}
		catch (error) {
			if (error instanceof ParserError) {
				error.path = metaFile;
			}
			throw error;
		}
		try {
			gamestateParsed = ParadoxDataHelper.loadFromString(gamestateString, report);
		}
		catch (error) {
			if (error instanceof ParserError) {
				error.path = gamestateFile;
			}
			throw error;
		}

		const save = new StellarisSave(metaParsed, gamestateParsed);
		save._tempDir = tempDir;
		return save;
	}

	/**
	 * Saves game state to file.
	 * @param saveFilePath Path to save file to.
	 * @param reportProgress Function to report progress (`step` out of `maxSteps`).
	 * @param reportMessage Function to update message (associated with progress).
	 */
	async saveToFile(
		saveFilePath: string,
		reportProgress?: (step: number, maxSteps: number) => void, 
		reportMessage?: (message: string) => void
	) {
		if (reportMessage) {
			reportMessage(`Saving gamestate and meta...`);
		}
		const metaString = ParadoxDataHelper.saveToString(this.meta._);
		const gamestateString = ParadoxDataHelper.saveToString(this.gamestate._);
		if (reportMessage) {
			reportMessage(`Saving gamestate and meta files...`);
		}
		if (!this._tempDir) {
			this._tempDir = await getSafeTemporaryDirectory();
		}
		await fs.writeFile(path.join(this._tempDir, 'meta'), metaString, 'utf-8');
		await fs.writeFile(path.join(this._tempDir, 'gamestate'), gamestateString, 'utf-8');
		if (reportMessage) {
			reportMessage(`Compressing files into save file...`);
		}
		await packTemporaryFilesIntoSave(saveFilePath, this._tempDir);
	}

	////////////////////////////////////////////////////////////////////////////////

	get name() {
		return stripSidesByCharacter(this.gamestate.$('name')._ as string);
	}
	set name(value: string) {
		this.gamestate.$('name')._ = `"${value}"`;
	}

	get version() {
		return stripSidesByCharacter(this.gamestate.$('version')._ as string);
	}

	get date() {
		return stripSidesByCharacter(this.gamestate.$('date')._ as string);
	}
	get dateRaw() {
		return this.gamestate.$('date')._ as string;
	}

	////////////////////////////////////////////////////////////////////////////////
	// Nebulas

	/**
	 * Finds Nebula by name.
	 * 
	 * Warning! Although rarely, there might be multiple nebulas 
	 * with the same name, in that case, only one will be returned.
	 */
	findNebulaByName(name: number) {
		return this.nebulas.find(n => n.name === `"${name}"`);
	}

	/**
	 * Finds Nebula by system which is contained by the nebula.
	 * 
	 * Warning! Although rarely, there might be multiple nebulas 
	 * containing the same system, in that case, only one will be returned.
	 */
	findNebulaBySystem(idOrHandle: number | SystemHandle) {
		const id = typeof idOrHandle === 'object' ? idOrHandle.id : idOrHandle;
		return this.nebulas.find(n => n.systemIds.includes(id));
	}

	////////////////////////////////////////////////////////////////////////////////
	// System

	/**
	 * Finds system by ID.
	 */
	findSystemById(id: number) {
		// We assume they cannot be removed or reordered.
		return this.systems[id];
	}

	/**
	 * Finds system by name.
	 * 
	 * Warning! There might be multiple systems with the same name, 
	 * in that case, only one will be returned.
	 */
	findSystemByName(name: string) {
		return this.systems.find(s => s.name === `"${name}"`);
	}

	/**
	 * Gets system handle by ID.
	 * If can't find, throws error.
	 */
	getSystemById(id: number) {
		const system = this.findSystemById(id);
		if (!system) {
			throw new MyError('system-not-found', `System not found by ID ${id}`);
		}
		return system;
	}

	/**
	 * Finds system by name.
	 * 
	 * Warning! There might be multiple systems with the same name, 
	 * in that case, only one will be returned.
	 * 
	 * If can't find, throws error.
	 */
	getSystemByName(name: string) {
		const system = this.findSystemByName(name);
		if (!system) {
			throw new MyError('system-not-found', `System not found by name ${name}`);
		}
		return system;
	}

	/**
	 * Gets system handle by ID, handle (pass) or name.
	 * If can't find, throws error.
	 */
	getSystem(idOrHandleOrName: number | SystemHandle | string) {
		if (typeof idOrHandleOrName === 'number') {
			return this.getSystemById(idOrHandleOrName)
		}
		if (idOrHandleOrName instanceof SystemHandle) {
			return idOrHandleOrName;
		}
		else {
			return this.getSystemByName(idOrHandleOrName);
		}
	}

	/**
	 * Finds systems closest to provided coords or system.
	 * 
	 * If system selected, the system is omitted. If no `requiredCount` will
	 * be provided, all systems will be returned, just sorted by distance.
	 */
	findSystemsClosestTo(coordsOrOtherSystem: CoordsPair | SystemHandle | number, requiredCount?: number) {
		let systemsSortedClosest;
		if (isCoordsPair(coordsOrOtherSystem)) {
			systemsSortedClosest = this.systems
				.map(s => [s, s.coords.distanceTo(coordsOrOtherSystem)] as const)
				.sort((a, b) => a[1] - b[1])
			;
		}
		else {
			const system = typeof coordsOrOtherSystem === 'number' ? 
				this.findSystemById(coordsOrOtherSystem) : coordsOrOtherSystem;
			if (!system) {
				throw new MyError('system-not-found', `System not found by ID ${coordsOrOtherSystem}.`);
			}
			const coords = system.coords;
			systemsSortedClosest = this.systems
				.filter(s => s.id != system.id)
				.map(s => [s, s.coords.distanceTo(coords)] as const)
				.sort((a, b) => a[1] - b[1])
			;
		}

		if (requiredCount) {
			systemsSortedClosest.splice(requiredCount);
		}

		return systemsSortedClosest.map(a => a[0]);
	}

	swapTwoStarSystems(
		a: SystemHandle | number, 
		b: SystemHandle | number, 
		settings?: { preservePrecursors?: boolean }
	) {
		settings ??= {};
		settings.preservePrecursors ??= true;

		const aSystem = this.getSystem(a);
		const bSystem = this.getSystem(b);
		const aId = aSystem.id;
		const bId = bSystem.id;

		const aSystemNeighboursIds = aSystem.$('hyperlane').$$().map(e => e.$('to')._ as number);
		const bSystemNeighboursIds = bSystem.$('hyperlane').$$().map(e => e.$('to')._ as number);
		const aHyperlanes = (aSystem.$('hyperlane')._ || []) as ParadoxDataObject;
		const bHyperlanes = (bSystem.$('hyperlane')._ || []) as ParadoxDataObject;
		aSystem.$('hyperlane')._ = bHyperlanes;
		bSystem.$('hyperlane')._ = aHyperlanes;

		aSystemNeighboursIds.forEach(id => {
			this.getSystem(id).$('hyperlane').$$().forEach(lane => {
				const toEntry = lane.$('to')._entry;
				if (toEntry[1] === aId) {
					toEntry[1] = bId;
				}
				// Handle direct neighbours
				else if (toEntry[1] === bId) {
					toEntry[1] = aId;
				}
			});
		});
		bSystemNeighboursIds.forEach(id => {
			this.getSystem(id).$('hyperlane').$$().forEach(lane => {
				const toEntry = lane.$('to')._entry;
				if (toEntry[1] === bId) {
					toEntry[1] = aId;
				}
				// Handle direct neighbours
				else if (toEntry[1] === aId) {
					toEntry[1] = bId;
				}
			});
		});
		
		const aSystemCoords = aSystem.$('coordinate')._;
		const bSystemCoords = bSystem.$('coordinate')._;
		aSystem.$('coordinate')._ = bSystemCoords;
		bSystem.$('coordinate')._ = aSystemCoords;

		const aNebula = this.findNebulaBySystem(aSystem);
		const bNebula = this.findNebulaBySystem(bSystem);
		if (aNebula != bNebula) {
			if (aNebula) {
				aNebula.removeSystem(aSystem);
				aNebula.addSystem(bSystem);
			}
			if (bNebula) {
				bNebula.removeSystem(bSystem);
				bNebula.addSystem(aSystem);
			}
		}
		// TODO: move nebulas background too - ambient_object filtered by 'nebula' string in 'data' field?

		if (settings.preservePrecursors) {
			precursorsFlags.forEach(flag => {
				const tmp = !!(aSystem.flags[flag]);
				aSystem.flags[flag] = !!(bSystem.flags[flag]);
				bSystem.flags[flag] = tmp;
			});
		}
	}

	////////////////////////////////////////////////////////////////////////////////
	// Planet

	/**
	 * Finds planet by ID.
	 */
	findPlanetById(id: number) {
		// We assume they cannot be removed or reordered.
		return this.planets[id];
	}

	/**
	 * Finds planet by ID.
	 * If can't find, throws error.
	 */
	 getPlanetById(id: number) {
		const planet = this.findPlanetById(id);
		if (!planet) {
			throw new MyError('Planet-not-found', `Planet not found by ID ${id}`);
		}
		return planet;
	}

	////////////////////////////////////////////////////////////////////////////////

	/**
	 * Finds leader by ID.
	 */
	findLeaderById(id: number) {
		return this.leaders.find(h => h.id === id);
	}

	/**
	 * Finds leader by ID.
	 * If can't find, throws error.
	 */
	getLeaderById(id: number) {
		const leader = this.findLeaderById(id);
		if (!leader) {
			throw new MyError('leader-not-found', `Leader not found by ID ${id}`);
		}
		return leader;
	}

	////////////////////////////////////////////////////////////////////////////////
	// Species

	/**
	 * Finds species by species index, as they don't have normal IDs
	 * for some reason.
	 */
	findSpeciesByIndex(index: number) {
		return this.species[index];
	}

	/**
	 * Finds species by species index, as they don't have normal IDs
	 * for some reason. If can't find, throws error.
	 */
	getSpeciesByIndex(index: number) {
		const species = this.findSpeciesByIndex(index);
		if (!species) {
			throw new MyError('species-not-found', `Species not found by index ${index}`);
		}
		return species;
	}

	/**
	 * Finds species by name.
	 * 
	 * Warning! There might be multiple species with the same name, 
	 * in that case, only one will be returned.
	 */
	findSpeciesByName(name: string) {
		return this.species.find(s => s.name === `"${name}"`);
	}

	////////////////////////////////////////////////////////////////////////////////
	// Country

	/**
	 * Finds country by ID.
	 */
	findCountryById(id: number) {
		return this.countries.find(h => h.id === id);
	}

	/**
	 * Finds country by ID.
	 * If can't find, throws error.
	 */
	getCountryById(id: number) {
		const country = this.findCountryById(id);
		if (!country) {
			throw new MyError('country-not-found', `Country not found by ID ${id}`);
		}
		return country;
	}

	////////////////////////////////////////////////////////////////////////////////
	// Ship design

	/**
	 * Finds ship design by ID.
	 * If can't find, throws error.
	 */
	findShipDesignById(id: number) {
		return this.shipDesigns.find(h => h.id === id);
	}

	/**
	 * Finds ship design by ID.
	 */
	getShipDesignById(id: number) {
		const design = this.shipDesigns.find(h => h.id === id);
		if (!design) {
			throw new MyError('ship-design-not-found', `Ship design not found by ID ${id}`);
		}
		return design;
	}

	////////////////////////////////////////////////////////////////////////////////
	// Ship

	/**
	 * Finds ship by ID.
	 */
	findShipById(id: number) {
		return this.ships.find(h => h.id === id);
	}

	/**
	 * Finds ship by ID.
	 * If can't find, throws error.
	 */
	getShipById(id: number) {
		const ship = this.ships.find(h => h.id === id);
		if (!ship) {
			throw new MyError('ship-not-found', `Ship not found by ID ${id}`);
		}
		return ship;
	}

	////////////////////////////////////////////////////////////////////////////////
	// Fleet

	/**
	 * Finds fleet by ID.
	 */
	findFleetById(id: number) {
		return this.fleets.find(h => h.id === id);
	}

	/**
	 * Finds fleet by ID.
	 * If can't find, throws error.
	 */
	getFleetById(id: number) {
		const fleet = this.fleets.find(h => h.id === id);
		if (!fleet) {
			throw new MyError('fleet-not-found', `Fleet not found by ID ${id}`);
		}
		return fleet;
	}

	////////////////////////////////////////////////////////////////////////////////
	// Fleet templates

	/**
	 * Finds fleet template by ID.
	 */
	findFleetTemplateById(id: number) {
		return this.fleetTemplates.find(h => h.id === id);
	}

	/**
	 * Finds fleet template by ID.
	 * If can't find, throws error.
	 */
	getFleetTemplateById(id: number) {
		const template = this.fleetTemplates.find(h => h.id === id);
		if (!template) {
			throw new MyError('fleet-template-not-found', `Fleet template not found by ID ${id}`);
		}
		return template;
	}

	deleteKilledFleetTemplates() {
		for (const fleetTemplate of this.fleetTemplates.filter(f => f.$('killed').value == 'yes')) {
			fleetTemplate.remove({ updateSave: false });
		}
		this.fleetTemplates = this.fleetTemplates.filter(h => h.value != undefined);
	}

	////////////////////////////////////////////////////////////////////////////////
	// Army

	/**
	 * Finds army by ID.
	 */
	findArmyById(id: number) {
		return this.armies.find(h => h.id === id);
	}

	/**
	 * Finds army by ID.
	 * If can't find, throws error.
	 */
	getArmyById(id: number) {
		const army = this.armies.find(h => h.id === id);
		if (!army) {
			throw new MyError('army-not-found', `Army not found by ID ${id}`);
		}
		return army;
	}

	////////////////////////////////////////////////////////////////////////////////

	/**
	 * Finds sector by ID.
	 */
	findSectorById(id: number) {
		return this.sectors.find(h => h.id === id);
	}

	/**
	 * Finds sector by ID.
	 * If can't find, throws error.
	 */
	getSectorById(id: number) {
		const sector = this.sectors.find(h => h.id === id);
		if (!sector) {
			throw new MyError('sector-not-found', `Sector not found by ID ${id}`);
		}
		return sector;
	}

	////////////////////////////////////////////////////////////////////////////////
}

export default StellarisSave;
