# Pittsburgh Opportunity Atlas

An interactive map for comparing poverty, transit commuting, housing tenure, and educational attainment across Pittsburgh. It covers 90 city neighborhood boundaries and 65 ACS reporting areas, with a citywide benchmark and two five-year periods.

## Run locally

From the repository root, run `python3 -m http.server 8000 --directory dist` and open [localhost:8000](http://localhost:8000). Select an indicator, pick two areas, and download the selected indicator as a CSV. The map also supports keyboard selection.

## Architecture

| File | Responsibility |
| --- | --- |
| `scripts/build_data.py` | Downloads City GeoJSON and Pitt's published profile PDF, extracts the two percentages per indicator, validates coverage, and projects geographic coordinates into SVG paths. |
| `dist/atlas.json` | Versioned data snapshot with one row per reporting area and a separate set of boundary shapes keyed to area IDs. |
| `dist/model.mjs` | Defines indicators and choropleth bands, computes percentage-point differences, and exports CSV. |
| `dist/app.mjs` | Loads the snapshot, wires up map and keyboard controls, and renders comparisons. |
| `tests/atlas.test.mjs` | Tests the shape-to-profile join, data ranges, sample values, map colors and CSV export. |

Static HTML, CSS and JavaScript keep the application portable. The browser loads one local data snapshot. The app needs no runtime API keys, tiles, database or Python server. Python is needed only to refresh the data. SVG paths preserve polygon holes using the even-odd fill rule. A local projection with longitude adjusted by the cosine of Pittsburgh's latitude is adequate for display at city scale. Use a projected GIS dataset for distance or area calculations.

## Rebuild and test

Install Python 3 and Poppler's `pdftotext`, then run `python3 scripts/build_data.py`. The extractor targets the March 2026 report layout. A future report may require updates to the row labels or group crosswalk. Inspect the output and verify values against the original tables after any source update.

Run `node --check dist/app.mjs` and `node --test tests/*.test.mjs` with Node 22 or later. GitHub Actions runs those checks on pull requests and pushes to main.

## Deploy on GitHub Pages

Create a GitHub repository and add these files to the `main` branch. In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source, then run **Test and deploy GitHub Pages** from the Actions tab if the initial push preceded that setting. Use the deployment URL from the workflow in your README.

## Data and interpretation

- [Pitt UCSUR Census Reports](https://www.ucsur.pitt.edu/reports/census-reports), March 2026 *Profiles of Change*. Published 2010–2014 and 2020–2024 ACS percentages. The city benchmark is the published city profile.
- [City of Pittsburgh neighborhoods via WPRDC](https://data.wprdc.org/dataset/neighborhoods2), CC Attribution. Geometry was projected and stripped of unrelated attributes.
- Some ACS reporting areas combine several neighborhoods. The Hazelwood profile covers Hazelwood, Glen Hazel, New Homestead and Hays. Each component polygon displays the shared group estimate and the export contains one record for the group. Chateau and South Shore have no published profiles.
- The map uses fixed 20-percentage-point intervals, so colors are comparable across indicators. The comparison card displays the published percentages to one decimal place and subtracts the older estimate from the newer one. Estimates and simple differences are descriptive. The snapshot does not include margins of error or statistical significance tests.
- Transit commuting is the share of workers who commute by public transportation. Renter share is the share of occupied units that are renter occupied. Neither measures transit service quality or housing affordability. University-heavy neighborhoods warrant particular care when interpreting poverty estimates.

## Interview walkthrough

Open the Hazelwood comparison and switch from poverty to transit commuting. Explain why the app stores boundary shapes separately from reporting-area estimates. Then open `build()` in the Python script to show how those two datasets join. Finally, trace the selected indicator from `render()` to `mapColor()` and `exportCsv()`. A useful extension would add margins of error directly from compatible ACS tables and document how uncertainty propagates through grouped estimates.
