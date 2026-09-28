// Gadget handlers by id. Each gadget task adds its line; the system builds one handler per entry.
import { createBatarangHandler } from './batarang.js';
import { createRemoteHandler } from './remote.js';

export const HANDLER_FACTORIES = {
  batarang: createBatarangHandler,
  remote: createRemoteHandler,
};
