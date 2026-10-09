import { useMemo } from "react";
import { useApp } from "../store/AppContext.jsx";
import { ownedSellerId } from "../services/access.js";
import { availableWorkspaces, WORKSPACES, workspaceOfView } from "../services/workspaces.js";

/** The signed-in account's workspaces, from the live session (no request). `go(id)` opens that workspace's own home. */
export function useWorkspaces(nav, view) {
  const { session, shopApplications } = useApp();
  const ownsShop = !!ownedSellerId(session, shopApplications);
  const ids = useMemo(() => availableWorkspaces(session, { ownsShop }), [session, ownsShop]);
  const current = workspaceOfView(view);
  return {
    ids,
    items: ids.map((id) => WORKSPACES[id]),
    current,
    multiple: ids.length > 1,
    go: (id) => { const w = WORKSPACES[id]; if (w && ids.includes(id)) nav(w.home.view, w.home.params); }, // never navigates to a workspace the account doesn't have
  };
}
