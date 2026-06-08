# Feature Requests & Known Issues – mcp-lexware-office

Erkenntnisse aus dem praktischen Einsatz (Stand: 2026-06-08).

---

## 1. `create-contact` – keine Adress-, E-Mail- und Telefonfelder

**Problem:** Das Tool `create-contact` unterstützt nur `firstName`, `lastName`,
`companyName` und `note`. Die Lexoffice API erlaubt jedoch vollständige Kontaktdaten
beim Anlegen:

```json
{
  "addresses": { "billing": [{ "street": "…", "zip": "…", "city": "…", "countryCode": "DE" }] },
  "emailAddresses": { "private": ["…"], "business": ["…"] },
  "phoneNumbers": { "mobile": ["…"] }
}
```

**Folge:** Adresse, E-Mail und Telefon müssen aktuell über einen separaten `PUT`-Aufruf
direkt gegen die Lexoffice REST-API nachgepflegt werden.

**Gewünschte Verbesserung:** Die fehlenden Felder in `create-contact` (und `update-contact`)
ergänzen, analog zur vollständigen API-Struktur.

---

## 2. `create-quotation` / `create-invoice` – `lineItems` vom Typ `service` / `material` schlagen fehl

**Problem:** Die Lexoffice API unterscheidet zwischen:

| `type`     | Bedeutung                          | Erfordert `id` |
|------------|------------------------------------|----------------|
| `service`  | Verweis auf Katalogartikel         | Ja (UUID aus dem Artikelkatalog) |
| `material` | Verweis auf Katalogartikel         | Ja (UUID aus dem Artikelkatalog) |
| `custom`   | Freie Position ohne Katalogreferenz | Nein           |

Das Tool-Schema (`lineItemSchema`) fordert kein `id`-Feld an und sendet es daher auch
nicht mit. Bei `type: "service"` oder `type: "material"` antwortet die API mit:

```
406 – lineItems[0].id: darf nicht leer sein
```

**Folge:** Angebote/Rechnungen mit `type: "service"` können über das MCP-Tool nicht
angelegt werden.

**Gewünschte Verbesserungen:**

1. **Kurzfristig:** Im Zod-Schema `lineItemSchema` ein optionales Feld `id` (UUID) für
   `service`/`material`-Positionen ergänzen.
2. **Mittelfristig:** In der Tool-Beschreibung klar dokumentieren, dass `type: "custom"`
   für freie Positionen zu verwenden ist und `service`/`material` eine bekannte
   Artikel-UUID benötigen.
3. **Optional:** Ein neues Tool `list-articles` anbieten, mit dem gültige Artikel-UUIDs
   aus dem Katalog abgerufen werden können, um sie in `service`/`material`-Positionen
   zu referenzieren.

---

## 3. `create-quotation` – fehlender `totalPrice` auf Dokumentebene

**Problem:** Das Tool fügt `totalPrice: { currency: 'EUR' }` korrekt auf
Dokumentebene ein (Quellcode Zeile ~553/599/927). Dennoch schlägt der direkte
API-Aufruf ohne dieses Feld mit `406 – The total price must not be null` fehl.

**Status:** Im MCP-Tool selbst bereits korrekt gelöst. Relevant als Hinweis für
direkte API-Aufrufe und als Dokumentation, warum der Payload nicht 1:1 dem entspricht,
was das Tool-Schema suggeriert.

---

## 4. `update-contact` – keine Adressfelder

Gleiche Einschränkung wie unter Punkt 1: Das Tool `update-contact` bietet keine
Felder für Adresse, E-Mail oder Telefon an, obwohl die API einen vollständigen
`PUT`-Body erwartet. Änderungen an diesen Feldern sind derzeit nur per direktem
API-Aufruf möglich.
