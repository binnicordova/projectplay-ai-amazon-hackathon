# Releasing Mimikai

Both apps build and ship with Expo EAS under the **llaapp** Expo account, and are published on Google Play by the **BinniCordova.com** developer account.

| App | Folder | Package | EAS project |
|---|---|---|---|
| Phone (teacher) | `teacher/` | `com.mimikai.teacher` | `@llaapp/mimikai-teacher` |
| TV | `tv/apps/expo-tv/` | `com.mimikai.tv` | `@llaapp/mimikai-tv` |

## Signing

EAS keeps each app's upload keystore (`eas credentials -p android` shows it). Google Play App Signing holds the real app-signing key, so a lost upload key can be reset from Play Console. Never commit a keystore.

## Store builds

Run each from the app's folder. The TV profiles set `EXPO_TV=1` themselves.

```bash
npx eas-cli build -p android -e production          # signed .aab, version code bumped by EAS
npx eas-cli submit -p android -e production --latest # upload as a draft to the internal track
```

The phone app needs the AI key on EAS before the first production build, because `.env` is not uploaded (do this yourself; never paste the key in chat or docs):

```bash
npx eas-cli env:create --environment production --name EXPO_PUBLIC_DEEPSEEK_API_KEY --visibility sensitive
```

`EXPO_PUBLIC_DEEPSEEK_MODEL` (plain text) is set the same way. Each build profile reads the EAS environment of the same name, so `preview` and `development` builds have no AI key until you add it there too.

`eas submit` needs a Google Play service-account key, and Google only accepts API uploads after the first `.aab` has been uploaded by hand in Play Console.

## Over-the-air updates

`expo-updates` checks for a new JavaScript bundle at launch but never waits for it (`fallbackToCacheTimeout: 0`): classes are offline, so the app always starts from the bundle it already has, and a downloaded update applies on the next launch.

```bash
npx eas-cli update --channel production --message "Short note for the log"
```

Updates reach only builds with the same `version` in `app.json` (`runtimeVersion` policy `appVersion`). Raise the version, and make a new store build, whenever native code, native dependencies, `app.json` or config plugins change; JavaScript-only changes can go out as updates. Changes to the phone ⇄ TV protocol must still reach both apps, so ship them to both channels together.
