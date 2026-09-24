/**
 * Every UI string of the PROFILE KIT (@allflow/profile-kit), in one place so
 * i18n (T5) can lift it as a whole: onboarding, profile, avatar, security,
 * admin of users and the loading states.
 *
 * Rules: plain strings or small functions that build a string; no JSX.
 */

export const profileCopy = {
  validation: {
    nameRequired: "El nombre es obligatorio",
    nameMax: "Máximo 100 caracteres",
    localeInvalid: "Elige un idioma de la lista",
    currentPasswordRequired: "Escribe tu contraseña actual",
    newPasswordMin: "Mínimo 8 caracteres",
    newPasswordMax: "Máximo 128 caracteres",
    newPasswordSame: "La nueva contraseña tiene que ser distinta de la actual",
    confirmRequired: "Repite la contraseña nueva",
    passwordsDontMatch: "Las contraseñas no coinciden",
  },

  locales: {
    es: "Español",
    en: "English",
  },

  common: {
    save: "Guardar cambios",
    saving: "Guardando…",
    cancel: "Cancelar",
    serverError: "No pudimos guardar los cambios. Inténtalo de nuevo.",
    notAllowed: "No tienes permiso para hacer esto.",
  },

  onboarding: {
    metaTitle: "Primeros pasos",
    title: "Configura tu cuenta",
    description: "Dos pasos rápidos. Puedes cambiar todo después en Configuración.",
    progress: (step: number, total: number) => `Paso ${step} de ${total}`,
    progressLabel: "Progreso de la configuración",
    steps: {
      profile: {
        title: "Cómo te llamamos",
        description: "Así te verán los demás usuarios.",
      },
      preferences: {
        title: "Tus preferencias",
        description: "El idioma en que prefieres usar la app.",
      },
      done: {
        title: "Todo listo",
        description: "Revisa tus datos y termina.",
      },
    },
    nameLabel: "Nombre",
    localeLabel: "Idioma",
    localeHelp: "Por ahora la app está en español; guardamos tu preferencia para cuando haya más idiomas.",
    summaryName: "Nombre",
    summaryLocale: "Idioma",
    back: "Atrás",
    next: "Siguiente",
    saving: "Guardando…",
    finish: "Terminar",
    finishing: "Terminando…",
    skip: "Saltar por ahora",
    skipping: "Saltando…",
    finished: "¡Listo! Tu cuenta está configurada.",
  },

  settings: {
    title: "Configuración",
    nav: "Secciones de configuración",
    profile: "Perfil",
    security: "Seguridad",
  },

  profile: {
    metaTitle: "Perfil",
    title: "Perfil",
    description: "Tu nombre y tu idioma.",
    nameLabel: "Nombre",
    emailLabel: "Correo electrónico",
    emailHelp: "El correo con que entras. No se puede cambiar desde aquí.",
    localeLabel: "Idioma",
    saved: "Perfil actualizado",
    unsavedTitle: "Tienes cambios sin guardar",
    unsavedDescription: "Si sales ahora, se pierden.",
    unsavedLeave: "Salir sin guardar",
    unsavedStay: "Seguir editando",
    unsavedHint: "Cambios sin guardar",
  },

  avatar: {
    title: "Foto de perfil",
    description: "PNG, JPG, WebP o GIF de hasta 5 MB. La recortamos cuadrada a 256 px.",
    alt: (name: string) => `Foto de ${name}`,
    choose: "Subir foto",
    change: "Cambiar foto",
    remove: "Quitar foto",
    uploading: "Subiendo la foto…",
    uploadProgress: "Progreso de la subida",
    invalidType: "Ese archivo no es una imagen PNG, JPG, WebP o GIF.",
    tooLarge: "La imagen pesa más de 5 MB. Elige una más liviana.",
    unreadable: "No pudimos leer esa imagen. Prueba con otra.",
    saved: "Foto actualizada",
    removed: "Foto eliminada",
    failed: "No pudimos guardar la foto. Inténtalo de nuevo.",
    confirmTitle: "¿Quitar tu foto de perfil?",
    confirmDescription: "Se mostrarán tus iniciales en su lugar.",
    confirmAction: "Quitar foto",
  },

  security: {
    metaTitle: "Seguridad",
    title: "Cambiar contraseña",
    description: "Te pedimos la actual para confirmar que eres tú.",
    currentPassword: "Contraseña actual",
    newPassword: "Contraseña nueva",
    newPasswordHelp: "Mínimo 8 caracteres.",
    confirmPassword: "Repite la contraseña nueva",
    revokeOthers: "Cerrar sesión en los demás dispositivos",
    submit: "Cambiar contraseña",
    submitting: "Cambiando…",
    wrongPassword: "La contraseña actual no es correcta.",
    noPassword: "Tu cuenta entra con enlace por correo y no tiene contraseña. Crea una desde «¿Olvidaste tu contraseña?» en la pantalla de inicio de sesión.",
    changed: "Contraseña cambiada",
    changedRevoked: "Contraseña cambiada. Cerramos las demás sesiones.",
    sessionsTitle: "Sesiones abiertas",
    sessionsDescription: (count: number) =>
      count === 1
        ? "Sólo tienes esta sesión abierta."
        : `Tienes ${count} sesiones abiertas, contando ésta.`,
    revokeButton: "Cerrar las demás sesiones",
    revoking: "Cerrando…",
    revoked: "Cerramos las demás sesiones",
    revokeFailed: "No pudimos cerrar las demás sesiones. Inténtalo de nuevo.",
    revokeConfirmTitle: "¿Cerrar las demás sesiones?",
    revokeConfirmDescription: "Tendrás que volver a entrar en los otros dispositivos. Ésta sigue abierta.",
  },

  adminUsers: {
    metaTitle: "Usuarios",
    title: "Usuarios",
    description: "Quién tiene acceso a la app y con qué rol.",
    tableCaption: "Usuarios de la app y sus roles",
    colUser: "Usuario",
    colRole: "Rol",
    colActions: "Acciones",
    you: "Tú",
    roles: {
      admin: "Administrador",
      member: "Miembro",
      owner: "Dueño",
    } as Record<string, string>,
    roleSelectLabel: (name: string) => `Rol de ${name}`,
    remove: "Quitar",
    removeLabel: (name: string) => `Quitar a ${name}`,
    roleChanged: (name: string, role: string) => `${name} ahora es ${role.toLowerCase()}`,
    removed: (name: string) => `Quitamos a ${name}`,
    failed: "No pudimos aplicar el cambio. Inténtalo de nuevo.",
    demoteTitle: (name: string) => `¿Quitarle el rol de administrador a ${name}?`,
    demoteDescription: "Dejará de ver esta sección y de poder cambiar roles.",
    demoteAction: "Quitar rol de administrador",
    removeTitle: (name: string) => `¿Quitar a ${name} de la app?`,
    removeDescription: "Perderá el acceso a los datos de la organización. Su cuenta sigue existiendo.",
    removeAction: "Quitar usuario",
    emptyTitle: "Todavía estás solo",
    emptyDescription: "Cuando otras personas creen su cuenta aparecerán aquí y podrás darles un rol.",
    emptyCta: "Copiar enlace de registro",
    linkCopied: "Enlace copiado",
    loadError: "No pudimos cargar los usuarios.",
    loadErrorDescription: "Puede ser un problema pasajero de conexión.",
  },

  loading: {
    page: "Cargando la página…",
    table: "Cargando usuarios…",
    form: "Cargando el formulario…",
  },
} as const
