import { Command, Option } from 'commander';
import { addSaveFileInputHandlingToCommand, addSaveFileOutputHandlingToCommand, loadSaveFileFancy, saveSaveFileFancy } from './common';
import StellarisSave from "@/StellarisSave";
import CoordsHandle from '@/handles/CoordsHandle';
import FleetHandle from '@/handles/FleetHandle';
import SystemHandle from '@/handles/SystemHandle';
import FleetTemplateHandle from '@/handles/FleetTemplateHandle';

const addMoreSystems = async (save: StellarisSave, count: number, array?: SystemHandle[]) => {
	while (count --> 0) {
		const handle = await SystemHandle.new(save);
		if (array) array.push(handle);
	}
}

const ensureSystemCountForBattles = async (save: StellarisSave, requiredCount: number, systemsToUse: SystemHandle[]) => {
	if (systemsToUse.length < requiredCount) {
		console.debug(`Adding more systems (${requiredCount - systemsToUse.length}) to accommodate fights...`);
		return addMoreSystems(save, requiredCount - systemsToUse.length, systemsToUse);
	}
}

export const registerCombatTestCommands = (parent: Command) => {
	const fleetsCommand = parent
		.command('combat:fleets')
		.description('prepares combat testing map by fighting with each other all fleets templates defined in fleet manager')
		.addOption(new Option('--ally-empire <id>', 'select empire which will be used as first side of battle and default source of templates').default(0).argParser(s => parseInt(s)))
		.addOption(new Option('--enemy-empire <id>', 'select empire which will be used as second side of battle').default(1).argParser(s => parseInt(s)))
		.option('--grid', 'creating grid taking designs from both ally and enemy empires for each axis')
		.option('--star-class <star_class>', 'star class to use for systems with battles', 'sc_b')
		.addOption(new Option('--radius <radius>', 'radius to use for systems with battles').default(250).argParser(s => parseInt(s)))
		.addOption(new Option('--distance <radius>', 'distance between fleets before battle').default(NaN, 'equal to radius').argParser(s => parseInt(s)))
		.action(async (options) => {
			const save = await loadSaveFileFancy(options.input);

			const allyEmpire    = save.getCountryById(options.allyEmpire);
			const enemyEmpire   = save.getCountryById(options.enemyEmpire);
			const preserveCountriesIds = [allyEmpire.id, enemyEmpire.id];

			save.deleteKilledFleetTemplates();

			console.debug(`Print fleet templates for reference...`);
			{
				let i = 0;
				console.log(`Fleet templates numbered:`);
				if (options.grid) {
					console.log(`\t(vertical axis, empire #${allyEmpire.id} aka '${allyEmpire.name}')`);
					for (const template of allyEmpire.fleetTemplates) {
						console.log(`${++i}.\t${`#${template.id}: `.padEnd(12)}${template.printCompositionAsString()}`);
					}
					console.log(`\t(horizontal axis, empire #${allyEmpire.id} aka '${allyEmpire.name}')`);
					for (const template of enemyEmpire.fleetTemplates) {
						console.log(`${++i}.\t${`#${template.id}: `.padEnd(12)}${template.printCompositionAsString()}`);
					}
				}
				else {
					for (const template of allyEmpire.fleetTemplates) {
						console.log(`${++i}.\t${`#${template.id}: `.padEnd(12)}${template.printCompositionAsString()}`);
					}
				}
			}

			console.debug(`Emptying map...`);
			{
				// Remove nebulas
				save.gamestate.removeSubentriesByKey('nebula');
			
				// Remove countries, except used/required
				for (const country of save.countries) {
					if (!preserveCountriesIds.includes(country.id)) {
						country.remove({
							fleetTemplates: false,
						});
					}
				}

				// TODO: cleanse hyperlanes

				// TODO: cleanse wormholes/gateways/mega-structures
			}

			const allySystemIds = new Set<number>();
			const enemySystemIds = new Set<number>();

			console.debug(`Preparing countries...`);
			{
				for (const sector of allyEmpire.sectors) {
					for(const id of sector.systemsIds) {
						allySystemIds.add(id);
					}
				}
				for (const sector of enemyEmpire.sectors) {
					for(const id of sector.systemsIds) {
						enemySystemIds.add(id);
					}
				}

				// Remove ally/enemy ships outside owned space
				for (const fleet of allyEmpire.ownedFleets) {
					if (!allySystemIds.has(fleet.coords.origin)) {
						fleet.remove();
					}
				}
				for (const fleet of enemyEmpire.ownedFleets) {
					if (!enemySystemIds.has(fleet.coords.origin)) {
						fleet.remove();
					}
				}

				// TODO: set war, add resources for upkeep, setup technologies/modifiers if needed
			}

			console.debug(`Filter systems to accommodate battles...`);
			// const starClassesData = await loadGameData('common/star_classes/*');
			// const bannedStarClasses = new Set<string>(new ParadoxDataObjectHandle(starClassesData).$$()
			// 	.filter(h => h.$('modifier').value != undefined)
			// 	.map(h => h.key as string)
			// );
			const systemsToUse = save.systems
				.filter(system => 
					!allySystemIds.has(system.id) &&
					!enemySystemIds.has(system.id)
					// && !bannedStarClasses.has(system.starClass)
				)
			;
			// TODO: remove systems, then add fresh ones

			const setupBattle = async (system: SystemHandle, allyTemplate: FleetTemplateHandle, enemyTemplate: FleetTemplateHandle) => {
				system.starClass = options.starClass;
				system.setRadius(options.radius);
				system.removeAllHyperlanes();
				system.name = `#${allyTemplate.id} vs #${enemyTemplate.id}`;
				allyEmpire.addSystemVisibility(system);
				enemyEmpire.addSystemVisibility(system);

				const allyFleet = await FleetHandle.newFromTemplate(
					allyTemplate, 
					allyEmpire, 
					CoordsHandle.forNewObject(-fleetX, -fleetY, system.id),
					`[#${allyTemplate.id}] vs #${enemyTemplate.id}`
				);
				const enemyFleet = await FleetHandle.newFromTemplate(
					enemyTemplate, 
					enemyEmpire, 
					CoordsHandle.forNewObject(fleetX, fleetY, system.id),
					`#${allyTemplate.id} vs [#${enemyTemplate.id}]`
				);
				allyFleet.orderAttack(enemyFleet);
				enemyFleet.orderAttack(allyFleet);
			}

			const spacingX = 25;
			const spacingY = 25;

			// Some maths for the fleets positions inside the systems
			const distance = (isNaN(options.distance) ? options.radius : options.distance) / 2;
			const angle = Math.PI / 6;
			const fleetX = Math.cos(angle) * distance;
			const fleetY = Math.sin(angle) * distance;

			const gridStartOffsetX = 0;
			const gridStartOffsetY = 0;
			let gridEndOffsetX: number;
			let gridEndOffsetY: number;
			if (options.grid) {
				const requiredSystemsCount = allyEmpire.fleetTemplatesCount * enemyEmpire.fleetTemplatesCount;
				await ensureSystemCountForBattles(save, requiredSystemsCount, systemsToUse);

				gridEndOffsetX = (enemyEmpire.fleetTemplatesCount - 1) * spacingX;
				gridEndOffsetY = (allyEmpire.fleetTemplatesCount - 1)  * spacingY;
				let offsetX = gridStartOffsetX;
				let offsetY = gridStartOffsetY;
				
				console.debug('Preparing battles grid...')
				process.stdout.write(`Preparing battles: 0% (0/${requiredSystemsCount})`);
				let count = 0;
				for (const allyTemplate of allyEmpire.fleetTemplates) {
					for (const enemyTemplate of enemyEmpire.fleetTemplates) {
						const system = systemsToUse.pop()!;

						system.coords.screenX = offsetX;
						system.coords.screenY = offsetY;
						await setupBattle(system, allyTemplate, enemyTemplate);

						offsetX += spacingX;

						count += 1;
						process.stdout.clearLine(0);
						process.stdout.cursorTo(0);
						process.stdout.write(`Preparing battles: ${(count / requiredSystemsCount * 100).toFixed(1)}% (${count}/${requiredSystemsCount})`);
					}
					offsetX = gridStartOffsetX;
					offsetY += spacingY;
				}
				offsetY = gridStartOffsetY;

				process.stdout.clearLine(0);
				process.stdout.cursorTo(0);
				process.stdout.write(`Prepared ${requiredSystemsCount} battles`);
			}
			else {
				const templates = allyEmpire.fleetTemplates;
				const requiredSystemsCount = templates.length * (templates.length + 1) / 2;
				await ensureSystemCountForBattles(save, requiredSystemsCount, systemsToUse);

				gridEndOffsetX = (templates.length - 1) * spacingX;
				gridEndOffsetY = (templates.length - 1) * spacingY;

				console.debug('Preparing battles stairs...')
				process.stdout.write(`Preparing battles: 0% (0/${requiredSystemsCount})`);
				let count = 0;
				for (let i = 0; i < templates.length; i++) {
					for (let j = 0; j <= i; j++) {
						const system = systemsToUse.pop()!;
						const allyTemplate = templates[i]!;
						const enemyTemplate = templates[j]!;

						system.coords.screenX = gridStartOffsetX + spacingX * j;
						system.coords.screenY = gridStartOffsetY + spacingY * i;
						await setupBattle(system, allyTemplate, enemyTemplate);

						count += 1;
						process.stdout.clearLine(0);
						process.stdout.cursorTo(0);
						process.stdout.write(`Preparing battles: ${(count / requiredSystemsCount * 100).toFixed(1)}% (${count}/${requiredSystemsCount})`);
					}
				}

				process.stdout.clearLine(0);
				process.stdout.cursorTo(0);
				process.stdout.write(`Prepared ${requiredSystemsCount} battles`);
			}

			console.debug(`Moving ally/enemy owned systems below...`);
			{
				const step = (gridEndOffsetX - gridStartOffsetX) / (allySystemIds.size + enemySystemIds.size - 1);
				let offsetX = gridStartOffsetX;
				const offsetY = gridEndOffsetY + spacingY * 2;
				for (const id of allySystemIds.values()) {
					const system = save.getSystemById(id);
					system.coords.screenX = offsetX;
					system.coords.screenY = offsetY;
					offsetX += step;
				}
				for (const id of enemySystemIds.values()) {
					const system = save.getSystemById(id);
					system.coords.screenX = offsetX;
					system.coords.screenY = offsetY;
					offsetX += step;
				}
			}

			// TODO: as soon as `systemHandle.remove` is implemented, remove the systems.
			console.debug(`Moving remaining systems further below...`);
			{
				const step = (gridEndOffsetX - gridStartOffsetX) / (systemsToUse.length - 1);
				let offsetX = gridStartOffsetX;
				const offsetY = gridEndOffsetY + spacingY * 4;
				let system;
				while (system = systemsToUse.pop()) {
					system.coords.screenX = offsetX;
					system.coords.screenY = offsetY;
					offsetX += step;
				}
			}

			console.info('Using `ai` console command to disable AI is required for now.');
			// TODO: force combat order even with AI active

			// throw new Error('not implemented, work in progress');
			await saveSaveFileFancy(options.output, save);
		})
	;
	addSaveFileInputHandlingToCommand(fleetsCommand);
	addSaveFileOutputHandlingToCommand(fleetsCommand);

	return {
		fleetsCommand
	};
}

export default registerCombatTestCommands;
