interface FatalErrorActions {
  log: (error: unknown) => void;
  closeDatabase: () => void;
  exit: (code: number) => void;
  forceExit: (code: number) => never;
}

export function createFatalErrorHandler(actions: FatalErrorActions): (error: unknown) => void {
  let exiting = false;
  return (error) => {
    if (exiting) actions.forceExit(1);
    exiting = true;
    try {
      actions.log(error);
    } catch {
      // Termination must not depend on logging succeeding.
    }
    try {
      actions.closeDatabase();
    } catch {
      // The database may already be damaged or closed.
    }
    try {
      actions.exit(1);
    } finally {
      actions.forceExit(1);
    }
  };
}
