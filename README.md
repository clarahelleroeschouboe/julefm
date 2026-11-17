# 📻 JULE FM – musikquiz til julefrokosten

Et live radioshow som quiz: spillerne bruger telefonen som buzzer, storskærmen er "radioen", og du styrer det hele fra quizmaster-dashboardet.

| Adresse | Hvem | Hvad |
|---|---|---|
| `/` | Deltagere (telefon) | Tilmelding + svar |
| `/tv` | Projektor/storskærm | Spørgsmål, afsløringer, stilling, podie |
| `/host` | Dig | Styring, redigering, Spotify, test (kræver kode) |

## Koncept i korte træk

7 "programmer" (runder) på ca. 50 minutter, hver med sin egen farve og spørgsmålstype:

1. 🎧 **Intro-trappen** – klippet bliver længere trin for trin, mens point-potten skrumper
2. 🎤 **Hvem holder mikrofonen?** – fritekst (stavefejl tilgives)
3. 📅 **Tidsmaskinen** – gæt årstallet på en slider, point efter hvor tæt du er
4. 🎄 **Jule-twist** – blanding: sortér, sandt/falsk, fritekst, årstal
5. 🔥 **Musikbattle** – afstemning hvor flertallet vinder (og én hvor mindretallet vinder)
6. 🎰 **Lykkehjulet** – du kan snurre *Frekvens-hjulet* før et spørgsmål: dobbelt op, tredobbelt, kun top 5 får point, turbo
7. 👑 **Finalen** – point ×2, væddemål med egne point (comeback-chance!) og sorteringsfinale

**Point:** hurtige svar giver mere · årstal/sortering giver delvise point · 🃏 én joker pr. spiller (×2) · streak-bonus ved 3+ rigtige i træk · væddemål vinder/taber indsatsen · bordenes kamp (gennemsnit pr. bord, så store borde ikke vinder på antal).
**Finale:** trommehvirvel → 3. plads → 2. plads → vinderen med konfetti → "Aftenens titler" (Lynhurtig, Skarpskytten, Tidsrejsende, Flokkens Hyrde, Raketten, Storspilleren m.fl. – alle får en titel).

Forbindelsen genoprettes automatisk, hvis en telefon mister nettet. Spillerne beholder deres point.

## Kør lokalt (test)

```bash
cd julefm
HOST_PASSWORD=jul node server.js     # kræver Node 18+, ingen pakker at installere
```
Åbn `http://localhost:3000/host` (kode: `jul`), `/tv` og `/` i hver sin fane. Fanen **🧪 Test & nulstil** → "Tilføj bots" fylder quizzen med virtuelle deltagere.

## Få quizzen online (Render – gratis, ca. 10 min)

Jeg kunne ikke deploye for dig herfra, så her er den enkleste vej:

1. Opret en gratis konto på **github.com** → **New repository** (fx `jule-fm`) → **uploading an existing file** → træk hele indholdet af mappen `julefm` ind (ikke selve zip-filen) → **Commit**.
2. Opret en gratis konto på **render.com** → **New + → Web Service** → vælg dit GitHub-repo.
3. Indstillinger: *Runtime* **Node**, *Build Command* `echo ok`, *Start Command* `node server.js`, *Instance type* **Free**.
4. Under **Environment** tilføjer du `HOST_PASSWORD` = din hemmelige quizmaster-kode.
5. **Create Web Service**. Efter 1–2 min får du et link som `https://jule-fm.onrender.com`. Det er spillernes link – storskærmen er `…/tv`, dit dashboard er `…/host`. QR-koden på storskærmen peger automatisk på det rigtige link.

**Gode råd til gratis hosting**
- Render lægger gratis-tjenester i dvale efter 15 min uden aktivitet, og første besøg efter dvale tager ca. 1 min. Åbn `/tv` en times tid før festen, så er den vågen – og den holder sig vågen, mens folk er forbundet.
- Gratis-diske nulstilles ved genstart/ny deploy. Derfor: når din quiz er færdigredigeret, så tryk **Test & nulstil → Hent quiz som fil**, og gem filen. Går noget galt: **Indlæs quiz-fil**. Du kan også lægge filen i repoet som `quiz.default.json`, så er den altid med.
- Vil du have ro i maven: Render *Starter* (ca. 7 USD/md.) eller Railway/Fly.io med et volume giver permanent lagring. Koden er den samme.

## Spotify 🎵

Hvad der virker (via Spotifys officielle Web Playback SDK): søg og vælg sange i editoren · "Match alle sange" finder alle sange automatisk · coverbillede og titel vises først ved afsløring · sangen starter automatisk, når spørgsmålet åbner, og stopper ved lås · Intro-trappen med klip i flere længder · startpunkt pr. sang · play/stop/lydstyrke fra dashboardet.

Begrænsninger, du skal kende:
- Kræver **Spotify Premium** på den konto, du logger ind med – og Spotify kræver, at developer-appens ejer har Premium (ændring fra feb. 2026).
- Musikken spiller **i din browser** (på quizmasterens computer) – tilslut den til højttalerne. Storskærmen spiller kun lydeffekter.
- Spotify tillader ikke at afspille sange baglæns eller hente 30-sek. preview-klip til nye apps, derfor er "baglæns"-runden erstattet af Intro-trappen.
- Søgning returnerer max 10 resultater pr. kald (Spotifys nye grænse).

**Opsætning (5 min):** developer.spotify.com/dashboard → *Create app* → Redirect URI: `https://DIT-LINK/host` (præcis den adresse; vises også i fanen 🎵 Spotify) → vælg *Web API* og *Web Playback SDK* → kopiér **Client ID** → indsæt i fanen 🎵 Spotify → **Log ind med Spotify** → **Aktivér lyd i browseren** → **Match alle sange automatisk**. Tjek derefter i editoren, at versionerne er de rigtige (live/remix kan snige sig ind), og justér evt. startpunkt.

Uden Spotify virker quizzen fint – dashboardet viser dig, hvad du skal søge efter og spille manuelt.

## Redigér quizzen (ingen kode)

Dashboardet → **✏️ Redigér quiz**: ændr tekst og svar, tilføj/slet/flyt/dupliker spørgsmål og programmer, tid og point pr. spørgsmål, multiplikator pr. program, sjove fakta, hold til/fra, sange med klip-trin. Tryk **Gem**.

## Under showet

- **Mellemrum** = næste trin (start → intro → gør klar → åbn → lås → afslør → næste …).
- 🎡 snurrer Frekvens-hjulet, 📊 viser stillingen på skærmen, 🎉 konfetti, ⏸ pause, +10 sek, ✔✘ vender et svar, +/−/± retter point, 📻 sender en tekst på et løbende bånd ("Baren åbner!").
- *Hop til* lader dig springe til et bestemt program/spørgsmål.

## Tekniske noter

Node-server uden afhængigheder (ingen `npm install`), realtid via Server-Sent Events, tilstand gemmes løbende i `data/`. Quizmaster-adgang beskyttes af `HOST_PASSWORD` (med begrænsning på login-forsøg). Spillere kan ikke se rigtige svar, før du afslører dem – svarene sendes aldrig til deres telefoner.
