// Gadget handlers by id. Each gadget task adds its line; the system builds one handler per entry.
import { createBatarangHandler } from './batarang.js';
import { createRemoteHandler } from './remote.js';
import { createGelHandler } from './gel.js';
import { createSmokeHandler } from './smoke.js';
import { createLauncherHandler } from './launcher.js';
import { createClawHandler } from './claw.js';

export const HANDLER_FACTORIES = {
  batarang: createBatarangHandler,
  remote: createRemoteHandler,
  gel: createGelHandler,
  smoke: createSmokeHandler,
  launcher: createLauncherHandler,
  claw: createClawHandler,
};
