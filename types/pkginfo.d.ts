declare module "pkginfo" {
  function pkginfo(module: NodeModule, ...options: string[]): void;
  function pkginfo(module: NodeModule, options: string[]): void;
  namespace pkginfo{}
  export = pkginfo
}
