# Hängender n8n-Verbindungstest (2026-10-28)

- [x] Veröffentlichten Paketstand 0.3.0 wiederherstellen und Credential-Test prüfen.
- [x] Verbindungstest ohne aufwendige Session-Abfrage, mit hartem Zeitlimit und sicheren Fehlermeldungen implementieren.
- [x] Regressionen für nicht antwortenden Transport, ungültige/abgelehnte Antworten und gültigen API-Token prüfen.
- [x] Typecheck, Tests, Lint, Build und Produktionsaudit ausführen.
- [ ] Getesteten Fix über GitHub veröffentlichen und npm-Stand verifizieren.

Ausgangsbefund: Der Credential-Test ruft GET /api/remote/sessions auf; dadurch wird die vollständige Session-Liste statt einer kleinen Authentifizierungs-/Metadatenabfrage geladen. Er verlässt sich allein auf das Timeout des Legacy-Request-Helpers. Eine unabhängige Frist fehlt; der UI-Aufruf bleibt offen, wenn der Helper nicht zurückkehrt. Live-Ursache in der Nutzerinstanz ist noch nicht verifiziert.

Prüfstand: 48 Tests bestanden; Typecheck, Lint (0 Fehler, bestehender Operationen-Hinweis), Build und Produktionsaudit (0 Befunde) erfolgreich. Echter n8n-core 2.16.1 CredentialTestContext gegen lokale HTTP-Endpunkte: Erfolg, 401, HTML, Redirect und Hänger bestanden; Hänger nach 10000 ms beendet; kein Redirect-Ziel aufgerufen. Kein Zugriff auf Nutzer-n8n oder dessen Konfiguration.
