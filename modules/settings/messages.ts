/**
 * Catalog of the settings module (entrypoint `messages`). Data only. The label
 * and description of each setting are NOT here: they are data of its definition.
 */
import type { WidenMessages } from "@/modules/contract/types"

export const es = {
  settings: {
    nav: "Ajustes de la app",
    page: {
      title: "Ajustes de la app",
      subtitle: "Valores que cambian el comportamiento de la app sin tocar el código.",
      secretsNote: "Aquí no se guardan secretos: claves, tokens ni contraseñas van en las variables de entorno.",
      readOnly: "Solo tienes permiso para ver estos ajustes.",
      empty: "Todavía no hay ajustes definidos.",
      emptyHint: "Los módulos y la app los declaran con defineSetting.",
      orphansTitle: "Valores sin definición",
      orphansHint: "Están guardados, pero ningún código los declara en este momento. Solo lectura.",
    },
    row: {
      sourceStored: "Valor guardado",
      sourceDefault: "Valor por defecto",
      sourceInvalid: "El valor guardado ya no es válido: se usa el valor por defecto",
      updated: "Cambiado el {date}",
      updatedBy: "Por {name}",
      defaultIs: "Por defecto: {value}",
    },
    form: {
      save: "Guardar",
      saving: "Guardando…",
      reset: "Volver al valor por defecto",
      resetting: "Restableciendo…",
      saved: "Ajuste guardado.",
      resetDone: "Ajuste restablecido.",
      yes: "Sí",
      no: "No",
    },
    errors: {
      forbidden: "No tienes permiso para cambiar ajustes.",
      invalid: "El valor no es válido para este ajuste.",
      unknown: "Ese ajuste no existe.",
      generic: "No se pudo guardar. Inténtalo de nuevo.",
    },
  },
} as const

export const en: WidenMessages<typeof es> = {
  settings: {
    nav: "App settings",
    page: {
      title: "App settings",
      subtitle: "Values that change how the app behaves without touching the code.",
      secretsNote: "No secrets here: keys, tokens and passwords belong in environment variables.",
      readOnly: "You can only view these settings.",
      empty: "No settings are defined yet.",
      emptyHint: "Modules and the app declare them with defineSetting.",
      orphansTitle: "Values without a definition",
      orphansHint: "They are stored, but no code declares them right now. Read only.",
    },
    row: {
      sourceStored: "Stored value",
      sourceDefault: "Default value",
      sourceInvalid: "The stored value is no longer valid: the default is used",
      updated: "Changed on {date}",
      updatedBy: "By {name}",
      defaultIs: "Default: {value}",
    },
    form: {
      save: "Save",
      saving: "Saving…",
      reset: "Back to default",
      resetting: "Resetting…",
      saved: "Setting saved.",
      resetDone: "Setting reset.",
      yes: "Yes",
      no: "No",
    },
    errors: {
      forbidden: "You do not have permission to change settings.",
      invalid: "The value is not valid for this setting.",
      unknown: "That setting does not exist.",
      generic: "Could not save. Try again.",
    },
  },
}
