import { useContext } from "react";
import { GroupCallContext } from "./group-call-context";
export const useGroupCall = () => useContext(GroupCallContext);
