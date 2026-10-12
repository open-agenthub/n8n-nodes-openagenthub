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
