# FAQ-Inhalte bearbeiten

Der gesamte Inhalt der FAQ-Seite steht in der Datei `faq.json`. Zum Ändern von Fragen und Antworten muss am Code nichts angepasst werden.

## Aufbau

Die Datei besteht aus Kategorien. Jede Kategorie hat einen Titel (`title`) und eine Liste von Einträgen (`items`). Jeder Eintrag besteht aus einer Frage (`question`) und einer Antwort (`answer`).

```json
[
  {
    "title": "Name der Kategorie",
    "items": [
      {
        "question": "Die Frage?",
        "answer": "Die Antwort."
      }
    ]
  }
]
```

- **Neuen Eintrag anlegen:** einen vorhandenen Eintrag (von `{` bis `}`) kopieren und direkt dahinter einfügen, mit einem Komma dazwischen.
- **Neue Kategorie anlegen:** eine vorhandene Kategorie kopieren, ebenfalls mit einem Komma dazwischen.
- Die Reihenfolge in der Datei ist die Reihenfolge auf der Seite.

## Regeln für die JSON-Datei

- Alle Texte stehen in geraden Anführungszeichen `"..."`.
- Zwischen zwei Einträgen steht ein Komma, nach dem **letzten** Eintrag einer Liste steht **kein** Komma.
- Gerade Anführungszeichen innerhalb eines Textes müssen als `\"` geschrieben werden. Einfacher ist es, typografische Zeichen zu verwenden: „so“.
- Ein Backslash im Text wird als `\\` geschrieben.
- Kommentare sind in JSON nicht erlaubt.
- Ein fehlendes oder überzähliges Komma ist der häufigste Fehler und führt dazu, dass die Seite nicht mehr lädt.

Tipp: Bearbeiten Sie die Datei in einem Editor mit JSON-Prüfung (z. B. VS Code). Syntaxfehler werden dort sofort rot markiert.

## Formatierung in Antworten (Markdown)

Antworten werden als Markdown interpretiert. Zeilenumbrüche werden im JSON als `\n` geschrieben.

| Gewünscht | Schreibweise im Antworttext |
|---|---|
| Fett | `**fetter Text**` |
| Kursiv | `*kursiver Text*` |
| Neuer Absatz | `\n\n` zwischen den Absätzen |
| Aufzählung | `\n\n- Punkt 1\n- Punkt 2` |
| Nummerierte Liste | `\n\n1. Schritt\n2. Schritt` |
| Link innerhalb der Anwendung | `[Linktext](/seitenpfad)` |
| Link auf externe Seite | `[Linktext](https://beispiel.de)` |
| Link auf E-Mail-Adresse | `[Kontakt](mailto:name@beispiel.de)` |

Hinweise:

- Ein einzelnes `\n` erzeugt **keinen** Zeilenumbruch. Für einen Umbruch immer `\n\n` (neuer Absatz) verwenden.
- Vor einer Liste steht immer eine Leerzeile (`\n\n`), zwischen den Listenpunkten genügt ein `\n`.
- Nach dem `-` bzw. `1.` muss ein Leerzeichen folgen.
- Interne Links beginnen immer mit `/`. Externe Links beginnen mit `https://` und öffnen in einem neuen Tab.
- HTML (z. B. `<b>` oder `<br>`) wird nicht unterstützt.

## Beispiel

```json
{
  "question": "Wie exportiere ich meine Ergebnisse?",
  "answer": "Ergebnisse lassen sich in zwei Formaten sichern:\n\n- **PDF** zur Weitergabe\n- **CSV** zur Auswertung\n\nDen Export finden Sie unter [Ergebnisse](/results). Mehr dazu im [Leitfaden](https://beispiel.de)."
}
```

Wird dargestellt als:

> Ergebnisse lassen sich in zwei Formaten sichern:
>
> - **PDF** zur Weitergabe
> - **CSV** zur Auswertung
>
> Den Export finden Sie unter *Ergebnisse*. Mehr dazu im *Leitfaden*.