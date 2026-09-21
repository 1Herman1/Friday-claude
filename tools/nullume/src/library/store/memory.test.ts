import { storeContract } from "./store.contract";
import { openMemoryStore } from "./memory";

storeContract("MemoryStore", () => openMemoryStore());
