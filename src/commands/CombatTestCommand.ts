import { Command } from 'commander';
import { addSaveFileInputHandlingToCommand, addSaveFileOutputHandlingToCommand, loadSaveFileFancy, saveSaveFileFancy } from './common';

export const registerCombatTestCommand = (parent: Command) => {
	const that = parent
		.command('combat')
		.alias('fleets')
		.description('prepares fleet testing map for all designs in fleet manager of player empire')
		.option('--empire <id>', 'select empire which will be used to load fleets designs', '0')
		.option('--ally-empire <id>', 'select empire which will be used as first side of battle', '0')
		.option('--enemy-empire <id>', 'select empire which will be used as second side of battle', '1')
		.action(async (options) => {
			const save = await loadSaveFileFancy(options.input);
			
			const designs = save.getCountryById(parseInt(options.empire)).shipDesigns.handles;
			const allyEmpire = save.getCountryById(parseInt(options.allyEmpire));
			const enemyEmpire = save.getCountryById(parseInt(options.enemyEmpire));
			const preserveCountries = [allyEmpire.id, enemyEmpire.id];

			console.log('Emptying map...');
			{
				// Remove nebulas
				save.gamestate.removeSubentriesByKey('nebula');

				// Remove countries, except used/required
				for (const country of save.countries) {
					if (!preserveCountries.includes(country.id)) {
						country.remove();
					}
				}
			}

			console.log('Preparing ships...');
			{
				for (const design of designs) {
					console.debug(design.name);
					// ...
				}
			}

			console.log('Preparing map...');
			{
				// ...
			}

			/*
				WIP. TODO:
				1. move systems into nice grid, remove hyperlanes
				2. create ships using selected designs list
				3. place ships against each other 
				4. add technologies/resources for upkeep/country modifiers
			 */

			throw new Error('not implemented, work in progress');
			await saveSaveFileFancy(options.output, save);
		})
	;
	addSaveFileInputHandlingToCommand(that);
	addSaveFileOutputHandlingToCommand(that);
	return that;
}

export default registerCombatTestCommand;
