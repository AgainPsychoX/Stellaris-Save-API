
export type CleanUpTask = () => Promise<void> | void;
export const cleanUpTasks: CleanUpTask[]  = [];

export const runCleanUpTasks = async () => {
	for (const task of cleanUpTasks) {
		await task();
	}
}

export const addCleanUpTask = (task: CleanUpTask) => {
	cleanUpTasks.push(task);
}

export const registerCleanUpBeforeExit = () => {
	process.on('beforeExit', async (code) => {
		await runCleanUpTasks();	
	});
}
