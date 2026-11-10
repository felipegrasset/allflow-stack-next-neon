/**
 * Lo único que un kit (u otro módulo) importa de kit-core:
 *   import { EmptyState, KitHeader } from "@/modules/kit-core/contracts"
 * Importar este archivo carga también los tokens (`--kit-*`) y las clases `.kit-*`.
 */
export { kitCopy } from "../ui/copy"
export {
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingState,
  NoResultsState,
  OfflineState,
  PartialState,
  StateBlock,
  SuccessState,
} from "../ui/states"
export type { KitAction, KitTone } from "../ui/states"
export { KitFooter, KitHeader, KitTheme } from "../ui/chrome"
export type { KitFooterColumn, KitLink } from "../ui/chrome"
