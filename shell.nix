{ pkgs ? import <nixpkgs> {} }:

let
  mutterDevkitShim = pkgs.writeShellScriptBin "mutter-devkit" ''
    exec ${pkgs.mutter}/bin/mutter "$@"
  '';
in
pkgs.mkShell {
  nativeBuildInputs = with pkgs; [
    pkg-config
    glib
  ];

  buildInputs = with pkgs; [
    gnome-shell
    mutter
    mutterDevkitShim
    nodejs
    typescript
    python3
    python3Packages.virtualenv
  ];

  shellHook = ''
    echo "Environment loaded with GNOME, TypeScript, and Python virtualenv support."
  '';
}
 