export const startMaintenance = (
  activities: Readonly<Record<string, () => Promise<void>>>,
  reportError: (activity: string, error: Error) => void,
) => {
  const pending = new Map<string, Promise<void>>();

  const tick = () => {
    for (const [name, run] of Object.entries(activities)) {
      if (pending.has(name)) {
        continue;
      }

      const work = (async () => {
        await Promise.resolve();

        try {
          await run();
        } catch (error) {
          reportError(name, error instanceof Error ? error : new Error(String(error)));
        } finally {
          pending.delete(name);
        }
      })();

      pending.set(name, work);
    }
  };

  tick();
  const timer = setInterval(tick, 1000);

  return async () => {
    clearInterval(timer);
    await Promise.all(pending.values());
  };
};
