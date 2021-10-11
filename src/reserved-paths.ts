// Name to reserved path
export const NAME_TO_RESERVED_PATH = {
  index: "/",
  noscript: "/noscript",
  version: "/version",
  help: "/help",
  faviconIco: "/favicon.ico",
  robotsTxt: "/robots.txt",
} as const;

export type ReservedPath = typeof NAME_TO_RESERVED_PATH[keyof (typeof NAME_TO_RESERVED_PATH)]

// All reserved paths
const RESERVED_PATHS: readonly ReservedPath[] =
  Object.values(NAME_TO_RESERVED_PATH);

export function isReservedPath(path: string): path is ReservedPath {
  return RESERVED_PATHS.includes(path as ReservedPath);
}
