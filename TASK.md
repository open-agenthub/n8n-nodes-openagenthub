# Auftrag: n8n Community Nodes für OpenAgentHub

- Neues öffentliches Repository `open-agenthub/n8n-nodes-openagenthub` erstellen.
- APIs aus aktuellem main und integrate/2026-10-10 prüfen; additive Integration-Funktionen unterstützen.
- Sessions starten, teilen, stoppen, Daten abrufen und Nachrichten senden.
- Hidden Sessions für bidirektionale Agent-Kommunikation prüfen und nach API-Möglichkeiten implementieren.
- Credentials und Requests sicher implementieren; keine Tokens in Logs/Fehlern.
- Aussagekräftige automatisierte Tests schreiben und ausführen, Paket bauen und prüfen.
- GitHub Actions für CI und spätere npm-Veröffentlichung vorbereiten.
- API-Prüfung, Implementierung und unabhängige Security-/Testprüfung auf Subagenten verteilen.
- Keine npm-Veröffentlichung im Rahmen dieses Auftrags; notwendige Publisher-Konfiguration dokumentieren.

## Umsetzung / Abgrenzung

- Repository erstellt: https://github.com/open-agenthub/n8n-nodes-openagenthub (öffentlich).
- Untersuchte Commits und Authentifizierungsgrenzen: siehe API-NOTES.md.
- Session-Steuerung, Messaging, Transcript/Conversation, Provider-Credentials und Enterprise-Sharing implementiert.
- Eingehende Nachrichten: Polling bestehender Sessions via Benutzer-JWT, mit isoliertem Deduplizierungszustand.
- Hidden/externe Session: in beiden untersuchten Backend-Branches nicht verfügbar; notwendige Backend-API und Grenzen in API-NOTES.md dokumentiert. Keine internen Pod-Tokens verwendet.
- GitHub-Umgebung npm erstellt, Deployments auf v*-Tags begrenzt; private Vulnerability Reports aktiviert.
- npm-Veröffentlichung vorbereitet, nicht ausgelöst. Einmalige npm Publisher-Einrichtung benötigt npm-Maintainerzugriff (RELEASE.md).
- Verbleibende Entwicklungsabhängigkeits-Advisories siehe SECURITY.md.

## Abschlussprüfung

- Lint erfolgreich (0 Fehler, ein unverbindlicher Strukturhinweis).
- Typecheck erfolgreich.
- 14 automatisierte Tests erfolgreich, einschließlich Security- und Trigger-Zustandstests.
- Build und npm-Paketvorschau erfolgreich; alle Nodes/Credentials und Icons tatsächlich geladen.
- Produktionsaudit: 0 Befunde.
- Keine Live-Deployment-Tests und keine npm-Veröffentlichung durchgeführt.
- GitHub-CI: [Workflow-Status](https://github.com/open-agenthub/n8n-nodes-openagenthub/actions/workflows/ci.yml); wird nach dem Push zusätzlich kontrolliert.

## GitHub/npm-Verknüpfung validieren

- 0.1.0 manuell auf npm veröffentlicht und Paketinhalt geprüft.
- 0.1.1 als Patch-Release über GitHub Actions veröffentlichen, um die neu konfigurierte npm Trusted-Publisher-Verknüpfung vor Ablauf am 2026-10-12 zu validieren.
- Version/Lockfile aktualisiert und Installationsdokumentation an veröffentlichtes Paket angepasst; Node-Verhalten unverändert.

### Ergebnis am 2026-10-10

- Release v0.1.1: https://github.com/open-agenthub/n8n-nodes-openagenthub/releases/tag/v0.1.1
- CI erfolgreich: https://github.com/open-agenthub/n8n-nodes-openagenthub/actions/runs/38050861059
- GitHub/npm-Publish erfolgreich: https://github.com/open-agenthub/n8n-nodes-openagenthub/actions/runs/38050923520
- npm hat 0.1.1 angenommen und GitHub-Provenance signiert (Transparenzlog 3185505255). Damit ist der erste Publish via Trusted Publisher vor der Frist erfolgt. npm meldete anschließend eine kurze Paket-Verarbeitungszeit.

## Native n8n Create-Session-Oberfläche

- Originales AgentHub-Logo aus frontend/public/favicon.svg übernehmen.
- Local-HTTP-Schalter als explizite lokale Entwicklungsoption erklären.
- Create JSON durch native Felder analog aktuellem UI ersetzen: Name, Harness, Login-Account, Git-Auswahl, Repositories, Projekt, MCP, Policy, Ressourcen und Ablauf.
- Dynamische Account-Auswahl mit token-scope-gefilterter Remote-API; zusätzliche UI-Kataloge nur mit Benutzer-JWT.
- Bestehende Node-v1-Workflows weiterhin ausführbar lassen.
- Tests, Build, CI und npm-Release des Updates prüfen.

### Prüfung Version 0.2.0

- 36 Tests erfolgreich; Typecheck, Lint (0 Fehler), Build und Paketvorschau erfolgreich.
- Ausgelieferte Node-/Credential-Klassen geladen; Logo mit upstream verglichen; Produktionsaudit ohne Befunde.
- Kein Live-Test gegen laufende AgentHub-/n8n-Instanzen.
- GitHub CI erfolgreich: https://github.com/open-agenthub/n8n-nodes-openagenthub/actions/runs/38054828169
- Release v0.2.0 erstellt; npm-Publish über Trusted Publisher erfolgreich: https://github.com/open-agenthub/n8n-nodes-openagenthub/actions/runs/38054902220

## Live-Fehlerbehebung nach 0.2.0

- Credential-Auflösung: n8n prüft nur den ersten Eintrag pro Typ; Versionierung korrigieren und real testen.
- Angegebenes GitHub-Avatar als PNG übernehmen; Hilfetexte ergänzen.
- GitLab-Kataloge für PAT benötigen sichere Backend-Remote-Routen; eingeschränkte Tokens bleiben ausgeschlossen.
- Lokale n8n-Instanz aufsetzen und Session-Erstellung testen; temporäre Ressourcen aufräumen.

### Prüfstand 2026-10-12 / 0.2.1

- 39 Tests, Typecheck, Lint ohne Fehler, Build und Paketvorschau erfolgreich; Produktionsaudit 0 Befunde.
- Live gegen dasselbe Backend via lokalem Testproxy (öffentliche Adresse im Pod nicht erreichbar): temporäre Codex-Session erfolgreich erstellt, abgerufen und gelöscht.
- Backend meldet remote Git discovery noch 404; gesonderte Backend-Erweiterung vorbereitet.
- Echter n8n-Instanztest läuft noch; Paket nicht vorzeitig als dort verifiziert markiert.

### Endgültiger Teststand 0.2.1

- 41 Tests grün; realen n8n-HTTP-Statuscode als String zusätzlich abgesichert.
- Echte n8n-2.16.0-Instanz: Harness-, Login- und Git-Credential-Optionslisten erfolgreich geladen; Upgradehinweis für fehlende Remote-Git-API korrekt angezeigt.
- n8n liefert tatsächlich exakt die Bytes des vom Benutzer verlinkten GitHub-Avatars aus.
- Echter n8n-CLI-Workflow Create → Get → Delete erfolgreich; danach unabhängiger Backend-GET liefert 404. Keine Testsession zurückgelassen.
- Reproduzierbarer tokenfreier Integrationstest in scripts/test-n8n-live.mjs, Details in TESTING.md.
- Backend-PR94 separat vorbereitet, 57 gezielte / 1606 Gesamttests grün (128 DB-Tests ohne PostgreSQL übersprungen), GitHub-Prüfungen grün. Noch kein Backend-Merge oder Deployment; Nutzerentscheidung angefragt.

### Veröffentlichung 0.2.1

- Paket-PR #1 übernommen; Main-CI erfolgreich: https://github.com/open-agenthub/n8n-nodes-openagenthub/actions/runs/38297464618
- Release: https://github.com/open-agenthub/n8n-nodes-openagenthub/releases/tag/v0.2.1
- GitHub Trusted Publishing mit signierter Provenance erfolgreich: https://github.com/open-agenthub/n8n-nodes-openagenthub/actions/runs/38297735941
- Temporäre Live-Testzugangsdaten und lokale n8n-Datenbanken entfernt; Testproxy gestoppt.
- Backend-PR #94 bleibt bis zur Nutzerentscheidung separat; GitLab-Discovery mit PAT benötigt anschließend dessen Deployment.

## API-Token als einzige Standardanmeldung (2026-10-17)

- Nutzerkorrektur: OIDC-Tokens sind kein nutzbarer Login-Weg; AgentHub-API-Token verwenden.
- Neue Standard-Nodeversion 3: einziges erforderliches Credential OpenAgentHub Personal API; keine Authentifizierungs-Auswahl. Bestehende v1/v2 bleiben kompatibel.
- Create/Listen/Abrufen/Steuern/Senden/Transkript sowie Update und Account-Wechsel nutzen PAT-Remote-Routen.
- Sharing mit bestätigten PAT-Remote-Routen anbieten; JWT-only Conversation/Messages nicht in v3 anbieten; Legacy-JWT-Trigger klar markieren. Fehlende sichere PAT-Endpunkte an AgentHub-Koordinator übergeben, Entscheidung/Backend-Arbeit dort.
- Manuelle Projekt-/MCP-IDs bleiben native Felder; verbundene Git-Kataloge über PAT-Remote-API.
- Version 0.3.0; Regressionstests prüfen Standard-Credentials, alte Versionen, native Erstellung trotz versteckter alter JWT-Auswahl sowie Update/Account-Wechsel über PAT.
- Abschließend 44 Tests erfolgreich; Typecheck, Lint (0 Fehler), Build und Produktionsaudit (0 Befunde) erfolgreich. Kein neuer Live-Instanztest für diese Version.
- Paket-PR #2 übernommen; Main-CI grün: https://github.com/open-agenthub/n8n-nodes-openagenthub/actions/runs/39043835689
- Release v0.3.0 über GitHub erfolgreich veröffentlicht: https://github.com/open-agenthub/n8n-nodes-openagenthub/actions/runs/39043902018
- Backend-Koordinator bestätigt Sharing-PAT-Routen; weitere Kataloge und Nachrichtenabruf werden in #130 durch remote-api-parity bearbeitet, API-Vertrag direkt abgestimmt.
