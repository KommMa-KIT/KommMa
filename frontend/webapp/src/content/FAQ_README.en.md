# Editing the FAQ content

All content of the FAQ page is stored in the file `faq.json`. No code changes are needed to edit questions and answers.

## Structure

The file consists of categories. Each category has a title (`title`) and a list of entries (`items`). Each entry consists of a question (`question`) and an answer (`answer`).

```json
[
  {
    "title": "Category name",
    "items": [
      {
        "question": "The question?",
        "answer": "The answer."
      }
    ]
  }
]
```

- **Adding a new entry:** copy an existing entry (from `{` to `}`) and paste it directly after it, with a comma in between.
- **Adding a new category:** copy an existing category, again with a comma in between.
- The order in the file is the order on the page.

## Rules for the JSON file

- All texts are enclosed in straight quotation marks `"..."`.
- A comma separates two entries. There is **no** comma after the **last** entry of a list.
- Straight quotation marks within a text must be written as `\"`. It is easier to use typographic quotation marks instead: „like this“.
- A backslash within a text is written as `\\`.
- Comments are not allowed in JSON.
- A missing or superfluous comma is the most common mistake and causes the page to stop loading.

Tip: Edit the file in an editor with JSON validation (e.g. VS Code). Syntax errors are highlighted in red immediately.

## Formatting in answers (Markdown)

Answers are interpreted as Markdown. Line breaks are written as `\n` in JSON.

| Desired result | How to write it in the answer text |
|---|---|
| Bold | `**bold text**` |
| Italic | `*italic text*` |
| New paragraph | `\n\n` between the paragraphs |
| Bulleted list | `\n\n- Item 1\n- Item 2` |
| Numbered list | `\n\n1. Step\n2. Step` |
| Link within the application | `[Link text](/page-path)` |
| Link to an external site | `[Link text](https://example.com)` |
| Link to an email address | `[Contact](mailto:name@example.com)` |

Notes:

- A single `\n` does **not** create a line break. Always use `\n\n` (new paragraph) for a break.
- A blank line (`\n\n`) always precedes a list. A single `\n` is enough between list items.
- A space must follow the `-` or `1.`.
- Internal links always start with `/`. External links start with `https://` and open in a new tab.
- HTML (e.g. `<b>` or `<br>`) is not supported.

## Example

```json
{
  "question": "How do I export my results?",
  "answer": "Results can be saved in two formats:\n\n- **PDF** for sharing\n- **CSV** for further analysis\n\nYou can find the export under [Results](/results). For more information, see the [guide](https://example.com)."
}
```

Rendered as:

> Results can be saved in two formats:
>
> - **PDF** for sharing
> - **CSV** for further analysis
>
> You can find the export under *Results*. For more information, see the *guide*.