# winget: `winget install DiceCodes.FreeGSTBilling`

Windows users can install (and later upgrade) the app from Microsoft's free
package list, winget, with one command:

```
winget install DiceCodes.FreeGSTBilling
winget upgrade DiceCodes.FreeGSTBilling
```

## Each release

After the GitHub release is published (the Setup must be attached):

```
npm run release:winget            # writes release-build/winget/manifests/.../<version>/
winget validate --manifest release-build\winget\manifests\d\DiceCodes\FreeGSTBilling\<version>
```

Then submit the three files as a pull request to
[microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs) under
`manifests/d/DiceCodes/FreeGSTBilling/<version>/` (from the IamRamgarhia fork),
**only with the maintainer's go-ahead**: it publishes the package. Microsoft's
checks run on the pull request; it usually merges within a few days.

The first pull request asks the account to accept Microsoft's contributor
agreement once (a comment on the pull request). That is the maintainer's to do.

## What is in the manifest

- The Windows Setup (`Free-GST-Billing-Windows-Setup.exe`, Inno Setup, per-user,
  no administrator rights: `Scope: user`), x64, Windows 10 or newer.
- Its SHA-256 is the one GitHub shows next to the file (the same one the app's
  own updater checks).
- `ProductCode: FreeGSTBilling_is1` is the Setup's uninstall entry, so winget
  sees an app installed from the Setup as this package (and can upgrade it).
- Silent installs use Inno Setup's switches; the app's own Update Now keeps
  working the same way.

Never `winget install --manifest` on the maintainer's PC to test it: that would
install over their real copy. Use a test PC or Windows Sandbox.
