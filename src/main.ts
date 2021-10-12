
import { Command, Option } from "commander";
import registerCombatTestCommand from "./commands/CombatTestCommand";
import registerInteractiveCommand from "./commands/InteractiveCommand";
import registerListCommand from "./commands/ListCommand";
import { registerPackCommand, registerUnpackCommand } from "./commands/PackingCommands";
import registerPrecursorsCommand from "./commands/PrecursorsCommand";
import registerReportCommand from "./commands/ReportCommand";
import { runCleanUpTasks } from "./utils/cleanup";
import { MyError } from "./utils/common";
import { setGameDirectory } from "./utils/gameData";

let isDebugActive = true;

if (process.platform != 'win32') {
	console.error('Only Windows is support for now!')
	process.exit(1);
}

const program = new Command();
program
	.name('ssa-cli')
	.version('0.1.0')
	.description('Set of tools to work with Stellaris save files.')
	.addOption(
		new Option('-d, --debug', 'output extra debugging info')
			.default(false)
			.env('DEBUG')
	)
	// TODO: 
	// .option('--saves-directory <path>', 'set custom saves directory')
	.option('--game-directory <path>', 'set path to game directory (if not specified, tries to detect or continue without)')
	.hook('preAction', async (thisCommand: Command, actionCommand: Command) => {
		const options = thisCommand.opts();
		if (!options.debug) {
			// Ignore debug output if no debug flag specified
			console.debug = (..._: any[]) => void(0);
			isDebugActive = false;
		}
		if (options.gameDirectory) {
			await setGameDirectory(options.gameDirectory);
		}
	})
;

registerListCommand(program);
registerPackCommand(program);
registerUnpackCommand(program);
registerInteractiveCommand(program);
registerPrecursorsCommand(program);
registerReportCommand(program);
registerCombatTestCommand(program);

program
	.parseAsync(process.argv)
	.catch(error => {
		console.error(isDebugActive ? error : error.toString());
		switch ((error as MyError).code) {
			case 'no-game-directory':
				console.error(`Use '--game-directory' option to provide custom path.`);
				break;
		}
	})
	.finally(async () => {
		runCleanUpTasks();
	})
;
