/**
 * Spanish (es) — the source locale. Every UI string of the floor's screens
 * (auth kit, profile kit) and of the i18n module itself.
 *
 * Rules:
 *  - Keys are nested (`auth.login.title`); a leaf is a string, never JSX.
 *  - Dynamic parts are ICU arguments: `"Hola, {name}"`. Plurals: ICU plural.
 *  - `en.ts` must have exactly the same keys and the same arguments:
 *    `pnpm test:modules` and `tsc` fail if one is missing.
 *  - A new namespace (a module's, a landing block's) is a new top-level key
 *    here and in en.ts.
 */
export const es = {
  auth: {
    common: {
      email: "Correo electrónico",
      password: "Contraseña",
      name: "Nombre",
      backToLogin: "Volver a iniciar sesión",
      backHome: "Ir al inicio",
      or: "o",
      retry: "Reintentar",
      loading: "Cargando…",
    },

    validation: {
      nameRequired: "El nombre es obligatorio",
      nameMax: "Máximo 100 caracteres",
      emailRequired: "El correo es obligatorio",
      emailInvalid: "Correo no válido",
      passwordRequired: "La contraseña es obligatoria",
      passwordMin: "Mínimo 8 caracteres",
      passwordMax: "Máximo 128 caracteres",
      passwordsDontMatch: "Las contraseñas no coinciden",
      confirmRequired: "Repite la contraseña",
    },

    errors: {
      invalidForm: "Revisa los datos del formulario.",
      rateLimited: "Demasiados intentos. Espera {seconds} s y vuelve a probar.",
      generic: "Algo salió mal. Inténtalo de nuevo.",
    },

    login: {
      title: "Iniciar sesión",
      description: "Entra con tu correo y contraseña.",
      submit: "Entrar",
      submitting: "Entrando…",
      forgot: "¿Olvidaste tu contraseña?",
      noAccount: "¿No tienes cuenta?",
      signupLink: "Crear una",
      invalidCredentials: "Correo o contraseña incorrectos.",
      emailNotVerified:
        "Todavía no confirmas tu correo. Te enviamos un enlace nuevo.",
      failed: "No pudimos iniciar sesión. Inténtalo de nuevo.",
      passwordChanged: "Contraseña actualizada. Entra con la nueva.",
    },

    magicLink: {
      title: "Entrar sin contraseña",
      description: "Te enviamos un enlace de un solo uso a tu correo.",
      submit: "Enviarme un enlace",
      submitting: "Enviando…",
      sent: "Si {email} puede entrar, te llegará un enlace en unos segundos. Vence en 5 minutos.",
      failed: "No pudimos enviar el enlace. Inténtalo de nuevo.",
      switchToMagic: "Entrar con un enlace por correo",
      switchToPassword: "Entrar con contraseña",
    },

    signup: {
      title: "Crear cuenta",
      description: "Regístrate con tu correo.",
      emailHelp: "Te enviaremos un enlace para confirmarlo.",
      passwordHelp: "Mínimo 8 caracteres.",
      submit: "Crear cuenta",
      submitting: "Creando cuenta…",
      haveAccount: "¿Ya tienes cuenta?",
      loginLink: "Inicia sesión",
      emailTaken: "Ese correo ya está registrado.",
      failed: "No pudimos crear la cuenta. Inténtalo de nuevo.",
    },

    verifyEmail: {
      title: "Revisa tu correo",
      sentTo: "Te enviamos un enlace de confirmación a",
      sentGeneric: "Te enviamos un enlace de confirmación.",
      openIt: "Ábrelo para activar tu cuenta.",
      notArrived: "¿No llegó? Revisa la carpeta de spam o pide otro.",
      askEmail: "Escribe tu correo y te enviamos un enlace nuevo.",
      resend: "Reenviar el correo",
      resending: "Reenviando…",
      cooldown: "Podrás reenviar en {seconds} s",
      resent: "Te enviamos un enlace nuevo.",
      resentDescription: "Puede tardar un minuto en llegar.",
      resendFailed:
        "No pudimos reenviar el correo. Inténtalo de nuevo en un momento.",
    },

    verifyCallback: {
      title: "Confirmación de correo",
      verifying: "Confirmando tu correo…",
      success: "¡Cuenta verificada!",
      successDescription: "Tu correo quedó confirmado y ya iniciaste sesión.",
      continue: "Continuar",
      expired: "El enlace venció",
      invalid: "El enlace no es válido",
      errorDescription:
        "Pide un enlace nuevo: los enlaces de confirmación vencen en una hora y sirven una sola vez.",
      resendCta: "Pedir un enlace nuevo",
    },

    forgot: {
      title: "¿Olvidaste tu contraseña?",
      description:
        "Escribe tu correo y te enviaremos un enlace para elegir una nueva.",
      submit: "Enviar enlace",
      submitting: "Enviando…",
      // Generic ON PURPOSE: never reveal whether an account exists for this email.
      sentTitle: "Revisa tu correo",
      sent: "Si existe una cuenta con ese correo, te enviamos un enlace para restablecer la contraseña. Vence en una hora.",
    },

    reset: {
      title: "Elige una contraseña nueva",
      description: "Mínimo 8 caracteres. Después entrarás con ella.",
      validating: "Validando el enlace…",
      newPassword: "Contraseña nueva",
      confirmPassword: "Repite la contraseña",
      submit: "Guardar contraseña",
      submitting: "Guardando…",
      invalidTitle: "El enlace no es válido o venció",
      invalidDescription:
        "Los enlaces para restablecer la contraseña vencen en una hora y sirven una sola vez.",
      requestNew: "Pedir un enlace nuevo",
      failed: "No pudimos cambiar la contraseña. Inténtalo de nuevo.",
    },

    shell: {
      skipLink: "Saltar al contenido",
      logout: "Cerrar sesión",
      signedInAs: "Sesión iniciada como",
      role: "Rol",
      welcome: "Hola, {name}",
      home: "Inicio",
      settings: "Configuración",
      admin: "Usuarios",
      mainNav: "Navegación principal",
      guestTitle: "Bienvenido",
      guestDescription: "Inicia sesión o crea una cuenta para continuar.",
    },

    notFound: {
      title: "Página no encontrada",
      description:
        "La dirección no existe o se movió. Revisa el enlace o vuelve al inicio.",
    },

    error: {
      title: "Algo salió mal",
      description:
        "Ocurrió un error inesperado. Puedes reintentar; si sigue pasando, vuelve más tarde.",
      code: "Código del error: {digest}",
    },

    globalError: {
      title: "La aplicación tuvo un problema",
      description: "No pudimos cargar la página. Reintenta en unos segundos.",
    },

    forbidden: {
      title: "No tienes acceso a esta sección",
      description:
        "Tu cuenta no tiene el rol necesario. Si crees que es un error, pide acceso a un administrador.",
    },

    toast: {
      close: "Cerrar aviso",
      region: "Notificaciones",
    },
  },
  profile: {
    validation: {
      nameRequired: "El nombre es obligatorio",
      nameMax: "Máximo 100 caracteres",
      localeInvalid: "Elige un idioma de la lista",
      currentPasswordRequired: "Escribe tu contraseña actual",
      newPasswordMin: "Mínimo 8 caracteres",
      newPasswordMax: "Máximo 128 caracteres",
      newPasswordSame:
        "La nueva contraseña tiene que ser distinta de la actual",
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
      description:
        "Dos pasos rápidos. Puedes cambiar todo después en Configuración.",
      progress: "Paso {step} de {total}",
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
      localeHelp:
        "Es el idioma en que verás la app. Puedes cambiarlo cuando quieras.",
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
      description:
        "PNG, JPG, WebP o GIF de hasta 5 MB. La recortamos cuadrada a 256 px.",
      alt: "Foto de {name}",
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
      noPassword:
        "Tu cuenta entra con enlace por correo y no tiene contraseña. Crea una desde «¿Olvidaste tu contraseña?» en la pantalla de inicio de sesión.",
      changed: "Contraseña cambiada",
      changedRevoked: "Contraseña cambiada. Cerramos las demás sesiones.",
      sessionsTitle: "Sesiones abiertas",
      sessionsDescription:
        "{count, plural, one {Sólo tienes esta sesión abierta.} other {Tienes # sesiones abiertas, contando ésta.}}",
      revokeButton: "Cerrar las demás sesiones",
      revoking: "Cerrando…",
      revoked: "Cerramos las demás sesiones",
      revokeFailed: "No pudimos cerrar las demás sesiones. Inténtalo de nuevo.",
      revokeConfirmTitle: "¿Cerrar las demás sesiones?",
      revokeConfirmDescription:
        "Tendrás que volver a entrar en los otros dispositivos. Ésta sigue abierta.",
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
      },
      roleSelectLabel: "Rol de {name}",
      remove: "Quitar",
      removeLabel: "Quitar a {name}",
      roleChanged: "{name} ahora es {role}",
      removed: "Quitamos a {name}",
      failed: "No pudimos aplicar el cambio. Inténtalo de nuevo.",
      demoteTitle: "¿Quitarle el rol de administrador a {name}?",
      demoteDescription: "Dejará de ver esta sección y de poder cambiar roles.",
      demoteAction: "Quitar rol de administrador",
      removeTitle: "¿Quitar a {name} de la app?",
      removeDescription:
        "Perderá el acceso a los datos de la organización. Su cuenta sigue existiendo.",
      removeAction: "Quitar usuario",
      emptyTitle: "Todavía estás solo",
      emptyDescription:
        "Cuando otras personas creen su cuenta aparecerán aquí y podrás darles un rol.",
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
  },
  i18n: {
    selectorLabel: "Idioma",
    selectorHelp: "Cambia el idioma de la aplicación",
    locales: {
      es: "Español",
      en: "English",
    },
  },
} as const
