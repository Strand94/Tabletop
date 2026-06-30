/**
 * Temporary Norwegian Bokmål string table. Full react-i18next externalization
 * (with `en` + a language switcher) lands in Stage 9; until then these constants
 * keep UI text out of components so the later migration is mechanical.
 */
export const t = {
  appName: 'Tabletop',
  tagline: 'Egendreven brettspillsporing',
  nav: {
    dashboard: 'Dashbord',
    collection: 'Samling',
    sessions: 'Partier',
    players: 'Spillere',
    settings: 'Innstillinger',
  },
  shelfOfShame: {
    title: 'Hylle uten spill',
    body: 'Spill som aldri er spilt. Planlegg en spillkveld?',
  },
  topbar: {
    searchCollection: 'Søk i samling…',
    logPlay: 'Logg et spill',
  },
  login: {
    title: 'Logg inn',
    subtitle: 'Velkommen tilbake til samlingen din',
    username: 'Brukernavn',
    password: 'Passord',
    submit: 'Logg inn',
    error: 'Feil brukernavn eller passord',
    loading: 'Logger inn…',
  },
  roles: {
    ADMIN: 'Admin',
    MEMBER: 'Medlem',
  },
  common: {
    signOut: 'Logg ut',
    toggleTheme: 'Bytt tema',
  },
} as const;
