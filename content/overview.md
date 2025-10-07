# Carry Over Open Work Items

Diese Azure DevOps Extension automatisiert den Prozess, offene Work Items aus dem letzten Sprint in den aktuellen Sprint zu übernehmen.

## 🚀 Funktionen

- Übernimmt **alle nicht erledigten Work Items** automatisch aus dem vorherigen Sprint.
- Funktioniert direkt im **Boards → Sprints → Backlog** über einen Button in der Toolbar.
- Unterstützt **alle Work Item-Typen** (Tasks, Bugs, PBIs, User Stories).
- Nutzt die **Azure DevOps REST API** für maximale Sicherheit und Kompatibilität.

## 🧭 Verwendung

1. Installiere die Extension in deiner Organisation.
2. Öffne **Boards → Sprints → Backlog**.
3. Klicke oben in der Toolbar auf **„Carry Over Open Items“**.
4. Die Extension übernimmt automatisch alle offenen Work Items aus dem vorherigen Sprint in den aktuellen.

## ⚙️ Berechtigungen

Die Extension benötigt folgende Scopes:
- `vso.work`
- `vso.work_write`

Diese sind notwendig, um Work Items zu lesen und zu aktualisieren.

## 🛠️ Geplante Erweiterungen

- Option zur automatischen Sprint-Erkennung
- Filtern nach Work Item-Typen
- Automatische Benachrichtigung bei Übernahme

---

**Publisher:** T3rr0rS0ck3
**Version:** 1.0.12
**Kategorie:** Azure Boards
**Repository:** https://github.com/T3rr0rS0ck3/azure-devops-carrry-over-extension
