# Members' daily card

Turns a day's plays into a printable PDF for paid members (posted in Whop).

```
node tools/daily-card/make-card.mjs today.csv          # first card of the day (v1)
node tools/daily-card/make-card.mjs today.csv --v 2    # after adding plays
```

The CSV needs `date,time,sport,game,pick,price`. Add a `new` column with `yes` to mark plays added since the last version.
Every other column (system, edge, notes) is dropped, so it never reaches members.
The PDF is made with Edge or Chrome in headless mode; with neither installed it saves an HTML file to print.

Never commit the CSV or the card. This folder is not part of the website build (only `dist/` is published).
