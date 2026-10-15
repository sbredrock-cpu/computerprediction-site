# computerprediction.com source

Push to this `source` branch and a GitHub Action builds the site and publishes it to `main`. Hostinger deploys `main` to public_html automatically.

- Pages: `src/pages`, shared header/footer: `src/partials`, styles and scripts: `src/assets`.
- Links and prices: `SITE` at the top of `build.mjs`.

## Results data (what the PC export writes)

`data/picks.csv`, one row per **graded** pick (never today's ungraded picks):

```
date,time,sport,game,pick,price,result,pl
2026-10-14,4:30 PM,NCAAF,Kennesaw State Owls @ Missouri State Bears,R.Collins Pass TDs Over 1.5,+194,L,-$100
```

- `date` is YYYY-MM-DD (game date, Pacific). `result` is W, L or P. `pl` is the profit at a flat $100 stake (`+$130`, `-$100`, `$0`).
- Quote any field that contains a comma.
- Don't include system names, sources or edge numbers.

`data/daily.csv` (`date,wins,losses,pushes,net`) is optional. A date listed there overrides the totals computed from picks.csv (used for 10/07, which has no pick detail).

The homepage scoreboard, ticker, headline ROI and the record page all recompute from these two files on every build.
