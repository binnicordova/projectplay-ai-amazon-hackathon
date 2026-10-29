# Google Play listings

Default language: Spanish (Latin America), `es-419`. Category: Education. Contact: llaapp.solutions+mimikai@gmail.com, https://llaapp.com. Privacy policy: https://github.com/binnicordova/projectplay-ai-amazon-hackathon/blob/main/docs/privacy.md

## Mimikai (`com.mimikai.teacher`, phone)

**Name:** Mimikai

**Short description (≤ 80):**
Convierte el proyector del aula en una pared táctil. Funciona sin internet.

**Full description:**

Mimikai convierte cualquier proyector en una pared táctil para toda la clase. Los niños responden de pie, señalando con la mano, y Mimikai, el pulpo de la clase, celebra cada acierto.

Cómo funciona
• Pon el celular en un trípode frente a la pared proyectada y comparte su Wi-Fi.
• Abre Mimikai TV en el televisor o Fire TV conectado al proyector. Se conecta solo.
• Mimikai calibra la pared por sí mismo: no hay que tocar esquinas.
• Elige una lección y juega: un equipo o dos equipos, cada uno en su mitad de la pared.

Lecciones listas para clase
Sílabas, letras, números, sumas y restas, fracciones, ecuaciones, inglés con imágenes y completar frases, pensadas para el currículo de primaria.

Crea tus propias lecciones con IA
Escribe lo que quieres practicar y Mimikai arma la lección. Tú la revisas antes de usarla. (Necesita internet solo en ese momento.)

Hecho para escuelas reales
• Sin internet en clase: el celular y el televisor hablan por Wi-Fi local.
• Privado: las imágenes de la cámara nunca salen del celular. No hay cuentas, publicidad ni analítica.
• Barato: solo necesitas el proyector que ya tienes, un celular Android y un Fire TV o Android TV.

Requiere Mimikai TV en el televisor o Fire TV conectado al proyector.

## Mimikai TV (`com.mimikai.tv`, Android TV / Fire TV)

**Name:** Mimikai TV

**Short description (≤ 80):**
La pantalla de Mimikai: los niños responden señalando la pared proyectada.

**Full description:**

Mimikai TV es la pantalla de la clase. Conecta tu televisor, Android TV o Fire TV al proyector y la pared se vuelve un juego: los niños responden señalando con la mano, por equipos o en grupo, y Mimikai, el pulpo de la clase, celebra cada acierto.

• Se conecta solo al celular del docente por Wi-Fi local. Sin internet.
• Muestra las lecciones que elige el docente: sílabas, letras, números, sumas, fracciones, inglés y más.
• Dos equipos, cada uno en su mitad de la pared, o un solo grupo en toda la pared.
• No guarda nada: la lección vive en memoria durante la clase.

Requiere la app Mimikai en el celular del docente (Android), que sigue a los niños con la cámara y envía las lecciones.

## Graphics

Made from `docs/brand/` (feature graphic, TV banner, 512 px icon). The phone and TV screenshots in `docs/store/play/` are exported from the editor in `store-screenshots/` (see its `MIMIKAI.md`), built on real captures: the teacher app on a Galaxy phone, the TV app on the TV box and in a web build with a stand-in phone.

## Release settings

- **Countries / regions (Production, both apps):** every country Play offers in the Americas and Europe (81). Countries outside those continents are not targeted.
- **AI asset label:** the icon, feature graphic and (TV) banner are labelled "created or edited using AI"; the screenshots are real app captures and are not labelled.
- **First bundles:** Mimikai version code 2, Mimikai TV version code 6 (TV targets API 36; Play rejected 34).

## App content answers (Play Console → Policy → App content)

What the code does, so the declarations stay true. Same answers for both apps unless marked.

| Declaration | Answer |
|---|---|
| Privacy policy | https://github.com/binnicordova/projectplay-ai-amazon-hackathon/blob/main/docs/privacy.md#readme (the `#readme` anchor only made Play re-check the URL after it had cached a 404 from before the merge) |
| Ads | No ads |
| Sign in details | Yes, restricted: "actions on another device". Note: no account, login or payment; a class needs the other app (Mimikai ⇄ Mimikai TV) on the same Wi-Fi; without it the phone app still opens the library, any lesson and *Crear con IA*. Tick "full access". |
| Advertising ID | No |
| Government apps | No |
| Financial features | My app doesn't provide any financial features |
| Health apps | My app does not have any health features |
| Content rating (IARC) | Category: All Other App Types. Ratings-relevant content in the package: No. Users interact or share content: No. Online content not in the download: **Yes** (AI-made and phone-sent lessons), then violence, sexuality, language, drugs: No. Age-restricted products: No. Shares location, digital purchases, cash rewards, browser: No. Primarily educational: Yes. Result: ESRB Everyone, PEGI 3, ClassInd All ages. |
| Target audience | 18 and over for both apps (teachers operate them; see the TV note below). The optional "restrict minors" box is left off. |
| Data safety, phone | Collects data: Yes. **App activity → Other user-generated content** (the text typed in *Crear con IA*, sent to DeepSeek to draft a lesson): app functionality, optional, processed ephemerally, not shared. **Device or other IDs** (random install ID sent by `expo-updates`): app functionality, required, not shared. Encrypted in transit: Yes. Account creation: none. Camera images are processed on the phone only, so they are **not** collected. |
| Data safety, TV | Collects data: Yes. **Device or other IDs** (`expo-updates` install ID): app functionality, required, not shared. Encrypted in transit: Yes. Phone ⇄ TV traffic stays on the local network and is not collected. |

**TV target audience is a judgement call.** Children look at and point at the wall, but only the teacher operates the TV and the phone. Declaring "18 and over" keeps the app out of the Families program; declaring children's ages puts Mimikai TV under the Families policy (teacher-approved review, and Google may object to the `expo-updates` install ID on a children's app).
