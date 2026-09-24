/**
 * Every UI string of the AUTH KIT (@allflow/auth-kit), in one place so i18n
 * (T5) can lift it as a whole: login, sign-up, email verification, password
 * recovery, the app shell (home, header) and the system screens (404, error,
 * global error, 403).
 *
 * Rules: plain strings or small functions that build a string; no JSX. Screens
 * import from here instead of writing literals. The app name comes from
 * lib/site.ts, never from this file.
 */

export const authCopy = {
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
    rateLimited: (seconds: number) =>
      `Demasiados intentos. Espera ${seconds} s y vuelve a probar.`,
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
    emailNotVerified: "Todavía no confirmas tu correo. Te enviamos un enlace nuevo.",
    failed: "No pudimos iniciar sesión. Inténtalo de nuevo.",
    passwordChanged: "Contraseña actualizada. Entra con la nueva.",
  },

  magicLink: {
    title: "Entrar sin contraseña",
    description: "Te enviamos un enlace de un solo uso a tu correo.",
    submit: "Enviarme un enlace",
    submitting: "Enviando…",
    sent: (email: string) =>
      `Si ${email} puede entrar, te llegará un enlace en unos segundos. Vence en 5 minutos.`,
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
    cooldown: (seconds: number) => `Podrás reenviar en ${seconds} s`,
    resent: "Te enviamos un enlace nuevo.",
    resentDescription: "Puede tardar un minuto en llegar.",
    resendFailed: "No pudimos reenviar el correo. Inténtalo de nuevo en un momento.",
  },

  verifyCallback: {
    title: "Confirmación de correo",
    verifying: "Confirmando tu correo…",
    success: "¡Cuenta verificada!",
    successDescription: "Tu correo quedó confirmado y ya iniciaste sesión.",
    continue: "Continuar",
    expired: "El enlace venció",
    invalid: "El enlace no es válido",
    errorDescription: "Pide un enlace nuevo: los enlaces de confirmación vencen en una hora y sirven una sola vez.",
    resendCta: "Pedir un enlace nuevo",
  },

  forgot: {
    title: "¿Olvidaste tu contraseña?",
    description: "Escribe tu correo y te enviaremos un enlace para elegir una nueva.",
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
    invalidDescription: "Los enlaces para restablecer la contraseña vencen en una hora y sirven una sola vez.",
    requestNew: "Pedir un enlace nuevo",
    failed: "No pudimos cambiar la contraseña. Inténtalo de nuevo.",
  },

  shell: {
    skipLink: "Saltar al contenido",
    logout: "Cerrar sesión",
    signedInAs: "Sesión iniciada como",
    role: "Rol",
    welcome: (name: string) => `Hola, ${name}`,
    home: "Inicio",
    settings: "Configuración",
    admin: "Usuarios",
    mainNav: "Navegación principal",
    guestTitle: "Bienvenido",
    guestDescription: "Inicia sesión o crea una cuenta para continuar.",
  },

  notFound: {
    title: "Página no encontrada",
    description: "La dirección no existe o se movió. Revisa el enlace o vuelve al inicio.",
  },

  error: {
    title: "Algo salió mal",
    description: "Ocurrió un error inesperado. Puedes reintentar; si sigue pasando, vuelve más tarde.",
    code: (digest: string) => `Código del error: ${digest}`,
  },

  globalError: {
    title: "La aplicación tuvo un problema",
    description: "No pudimos cargar la página. Reintenta en unos segundos.",
  },

  forbidden: {
    title: "No tienes acceso a esta sección",
    description: "Tu cuenta no tiene el rol necesario. Si crees que es un error, pide acceso a un administrador.",
  },

  toast: {
    close: "Cerrar aviso",
    region: "Notificaciones",
  },
} as const
