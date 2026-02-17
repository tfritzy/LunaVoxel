import { EditHistory } from "@/modeling/lib/edit-history";
import { stateStore } from "./store";

export const editHistory = new EditHistory(stateStore, "local-project");
