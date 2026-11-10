import type { Messages } from "./types"

/**
 * English (en). Same keys and same ICU arguments as es.ts (the type forces the
 * keys; `pnpm test:modules` checks the arguments).
 */
export const en: Messages = {
  auth: {
    common: {
      email: "Email",
      password: "Password",
      name: "Name",
      backToLogin: "Back to sign in",
      backHome: "Go to the home page",
      or: "or",
      retry: "Try again",
      loading: "Loading…",
    },

    validation: {
      nameRequired: "Name is required",
      nameMax: "At most 100 characters",
      emailRequired: "Email is required",
      emailInvalid: "Invalid email",
      passwordRequired: "Password is required",
      passwordMin: "At least 8 characters",
      passwordMax: "At most 128 characters",
      passwordsDontMatch: "Passwords don't match",
      confirmRequired: "Repeat the password",
    },

    errors: {
      invalidForm: "Check the form fields.",
      rateLimited: "Too many attempts. Wait {seconds} s and try again.",
      generic: "Something went wrong. Please try again.",
    },

    login: {
      title: "Sign in",
      description: "Sign in with your email and password.",
      submit: "Sign in",
      submitting: "Signing in…",
      forgot: "Forgot your password?",
      noAccount: "Don't have an account?",
      signupLink: "Create one",
      invalidCredentials: "Incorrect email or password.",
      emailNotVerified:
        "You haven't confirmed your email yet. We sent you a new link.",
      failed: "We couldn't sign you in. Please try again.",
      passwordChanged: "Password updated. Sign in with the new one.",
    },

    magicLink: {
      title: "Sign in without a password",
      description: "We email you a single-use link.",
      submit: "Email me a link",
      submitting: "Sending…",
      sent: "If {email} can sign in, a link will arrive in a few seconds. It expires in 5 minutes.",
      failed: "We couldn't send the link. Please try again.",
      switchToMagic: "Sign in with an email link",
      switchToPassword: "Sign in with a password",
    },

    signup: {
      title: "Create account",
      description: "Sign up with your email.",
      emailHelp: "We'll send you a link to confirm it.",
      passwordHelp: "At least 8 characters.",
      submit: "Create account",
      submitting: "Creating account…",
      haveAccount: "Already have an account?",
      loginLink: "Sign in",
      emailTaken: "That email is already registered.",
      failed: "We couldn't create the account. Please try again.",
    },

    verifyEmail: {
      title: "Check your email",
      sentTo: "We sent a confirmation link to",
      sentGeneric: "We sent you a confirmation link.",
      openIt: "Open it to activate your account.",
      notArrived: "Didn't arrive? Check your spam folder or ask for another.",
      askEmail: "Enter your email and we'll send you a new link.",
      resend: "Resend the email",
      resending: "Resending…",
      cooldown: "You can resend in {seconds} s",
      resent: "We sent you a new link.",
      resentDescription: "It may take a minute to arrive.",
      resendFailed: "We couldn't resend the email. Try again in a moment.",
    },

    verifyCallback: {
      title: "Email confirmation",
      verifying: "Confirming your email…",
      success: "Account verified!",
      successDescription: "Your email is confirmed and you're signed in.",
      continue: "Continue",
      expired: "The link has expired",
      invalid: "The link is not valid",
      errorDescription:
        "Ask for a new link: confirmation links expire after one hour and work only once.",
      resendCta: "Ask for a new link",
    },

    forgot: {
      title: "Forgot your password?",
      description:
        "Enter your email and we'll send you a link to choose a new one.",
      submit: "Send link",
      submitting: "Sending…",
      sentTitle: "Check your email",
      sent: "If an account exists for that email, we sent you a link to reset the password. It expires in one hour.",
    },

    reset: {
      title: "Choose a new password",
      description: "At least 8 characters. You'll sign in with it afterwards.",
      validating: "Validating the link…",
      newPassword: "New password",
      confirmPassword: "Repeat the password",
      submit: "Save password",
      submitting: "Saving…",
      invalidTitle: "The link is not valid or has expired",
      invalidDescription:
        "Password reset links expire after one hour and work only once.",
      requestNew: "Ask for a new link",
      failed: "We couldn't change the password. Please try again.",
    },

    shell: {
      skipLink: "Skip to content",
      logout: "Sign out",
      signedInAs: "Signed in as",
      role: "Role",
      welcome: "Hello, {name}",
      home: "Home",
      settings: "Settings",
      admin: "Users",
      mainNav: "Main navigation",
      guestTitle: "Welcome",
      guestDescription: "Sign in or create an account to continue.",
    },

    notFound: {
      title: "Page not found",
      description:
        "The address doesn't exist or has moved. Check the link or go back home.",
    },

    error: {
      title: "Something went wrong",
      description:
        "An unexpected error occurred. You can try again; if it keeps happening, come back later.",
      code: "Error code: {digest}",
    },

    globalError: {
      title: "The application ran into a problem",
      description: "We couldn't load the page. Try again in a few seconds.",
    },

    forbidden: {
      title: "You don't have access to this section",
      description:
        "Your account doesn't have the required role. If you think this is a mistake, ask an administrator for access.",
    },

    toast: {
      close: "Dismiss notification",
      region: "Notifications",
    },
  },

  profile: {
    validation: {
      nameRequired: "Name is required",
      nameMax: "At most 100 characters",
      localeInvalid: "Choose a language from the list",
      currentPasswordRequired: "Enter your current password",
      newPasswordMin: "At least 8 characters",
      newPasswordMax: "At most 128 characters",
      newPasswordSame:
        "The new password must be different from the current one",
      confirmRequired: "Repeat the new password",
      passwordsDontMatch: "Passwords don't match",
    },

    locales: {
      es: "Español",
      en: "English",
    },

    common: {
      save: "Save changes",
      saving: "Saving…",
      cancel: "Cancel",
      serverError: "We couldn't save the changes. Please try again.",
      notAllowed: "You don't have permission to do this.",
    },

    onboarding: {
      metaTitle: "Getting started",
      title: "Set up your account",
      description:
        "Two quick steps. You can change everything later in Settings.",
      progress: "Step {step} of {total}",
      progressLabel: "Setup progress",
      steps: {
        profile: {
          title: "What should we call you",
          description: "This is how other users will see you.",
        },
        preferences: {
          title: "Your preferences",
          description: "The language you prefer to use the app in.",
        },
        done: {
          title: "All set",
          description: "Review your details and finish.",
        },
      },
      nameLabel: "Name",
      localeLabel: "Language",
      localeHelp:
        "This is the language you'll see the app in. You can change it any time.",
      summaryName: "Name",
      summaryLocale: "Language",
      back: "Back",
      next: "Next",
      saving: "Saving…",
      finish: "Finish",
      finishing: "Finishing…",
      skip: "Skip for now",
      skipping: "Skipping…",
      finished: "Done! Your account is set up.",
    },

    settings: {
      title: "Settings",
      nav: "Settings sections",
      profile: "Profile",
      security: "Security",
    },

    profile: {
      metaTitle: "Profile",
      title: "Profile",
      description: "Your name and your language.",
      nameLabel: "Name",
      emailLabel: "Email",
      emailHelp: "The email you sign in with. It can't be changed from here.",
      localeLabel: "Language",
      saved: "Profile updated",
      unsavedTitle: "You have unsaved changes",
      unsavedDescription: "If you leave now, they will be lost.",
      unsavedLeave: "Leave without saving",
      unsavedStay: "Keep editing",
      unsavedHint: "Unsaved changes",
    },

    avatar: {
      title: "Profile photo",
      description:
        "PNG, JPG, WebP or GIF up to 5 MB. We crop it square at 256 px.",
      alt: "Photo of {name}",
      choose: "Upload photo",
      change: "Change photo",
      remove: "Remove photo",
      uploading: "Uploading the photo…",
      uploadProgress: "Upload progress",
      invalidType: "That file is not a PNG, JPG, WebP or GIF image.",
      tooLarge: "The image is larger than 5 MB. Choose a lighter one.",
      unreadable: "We couldn't read that image. Try another one.",
      saved: "Photo updated",
      removed: "Photo removed",
      failed: "We couldn't save the photo. Please try again.",
      confirmTitle: "Remove your profile photo?",
      confirmDescription: "Your initials will be shown instead.",
      confirmAction: "Remove photo",
    },

    security: {
      metaTitle: "Security",
      title: "Change password",
      description: "We ask for the current one to confirm it's you.",
      currentPassword: "Current password",
      newPassword: "New password",
      newPasswordHelp: "At least 8 characters.",
      confirmPassword: "Repeat the new password",
      revokeOthers: "Sign out on all other devices",
      submit: "Change password",
      submitting: "Changing…",
      wrongPassword: "The current password is not correct.",
      noPassword:
        "Your account signs in with an email link and has no password. Create one from «Forgot your password?» on the sign-in screen.",
      changed: "Password changed",
      changedRevoked: "Password changed. We signed out your other sessions.",
      sessionsTitle: "Open sessions",
      sessionsDescription:
        "{count, plural, one {This is your only open session.} other {You have # open sessions, including this one.}}",
      revokeButton: "Sign out other sessions",
      revoking: "Signing out…",
      revoked: "We signed out your other sessions",
      revokeFailed:
        "We couldn't sign out the other sessions. Please try again.",
      revokeConfirmTitle: "Sign out the other sessions?",
      revokeConfirmDescription:
        "You'll have to sign in again on your other devices. This one stays open.",
    },

    adminUsers: {
      metaTitle: "Users",
      title: "Users",
      description: "Who has access to the app and with which role.",
      tableCaption: "App users and their roles",
      colUser: "User",
      colRole: "Role",
      colActions: "Actions",
      you: "You",
      roles: {
        admin: "Administrator",
        member: "Member",
        owner: "Owner",
      },
      roleSelectLabel: "Role of {name}",
      remove: "Remove",
      removeLabel: "Remove {name}",
      roleChanged: "{name} is now {role}",
      removed: "We removed {name}",
      failed: "We couldn't apply the change. Please try again.",
      demoteTitle: "Remove the administrator role from {name}?",
      demoteDescription:
        "They will no longer see this section or be able to change roles.",
      demoteAction: "Remove administrator role",
      removeTitle: "Remove {name} from the app?",
      removeDescription:
        "They will lose access to the organization's data. Their account still exists.",
      removeAction: "Remove user",
      emptyTitle: "You're still on your own",
      emptyDescription:
        "When other people create their account they'll show up here and you can give them a role.",
      emptyCta: "Copy sign-up link",
      linkCopied: "Link copied",
      loadError: "We couldn't load the users.",
      loadErrorDescription: "It may be a temporary connection problem.",
    },

    loading: {
      page: "Loading the page…",
      table: "Loading users…",
      form: "Loading the form…",
    },
  },

  i18n: {
    selectorLabel: "Language",
    selectorHelp: "Change the language of the application",
    locales: {
      es: "Español",
      en: "English",
    },
  },
}
