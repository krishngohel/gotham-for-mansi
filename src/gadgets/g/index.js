// Gadget handlers by id. Each gadget task adds its line; the system builds one handler per entry.
import { createBatarangHandler } from './batarang.js';

export const HANDLER_FACTORIES = {
  batarang: createBatarangHandler,
};
