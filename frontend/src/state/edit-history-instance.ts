import { EditHistory } from "@/modeling/lib/edit-history";
import { stateStore, registerEditHistory } from "./store";

export const editHistory = new EditHistory(stateStore, "local-project");
registerEditHistory(editHistory);
