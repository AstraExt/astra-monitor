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
    mutter
    mutterDevkitShim
  ];

  shellHook = ''
    echo "Environment loaded with mutter-devkit shim."
  '';
}