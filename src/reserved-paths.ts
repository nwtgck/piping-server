// Name to reserved path
export const NAME_TO_RESERVED_PATH = {
  index: "/",
  noscript: "/noscript",
  version: "/version",
  help: "/help",
  faviconIco: "/favicon.ico",
  robotsTxt: "/robots.txt",
};

// All reserved paths
export const RESERVED_PATHS: string[] =
  Object.values(NAME_TO_RESERVED_PATH);
