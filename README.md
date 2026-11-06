**English | [简体中文](README.zh-CN.md)**

<p align="center">
  <img src="./assets/readme/hero-en-v2.svg" width="100%" alt="Bing Archive: A new view, every day.">
</p>

<p align="center"><img src="./site/assets/og-image.jpg" width="100%" alt="Bing wallpaper from the archive"></p>

Explore an automatically updated archive of Bing's daily wallpapers. Filter by category or color, search metadata, preview originals and download selections.

[Open the archive](https://ygn-bing-wallpaper.pages.dev/) · [GitHub Pages fallback](https://yangn-st.github.io/bing_wallpaper_archive/)

## Explore

- Combine keyword, year, month, category and color filters.
- Preview originals, switch between 1080p and UHD when available, or copy an image link.
- Download one image directly or bundle multiple selections as a ZIP in the browser.

The site is static HTML, CSS and JavaScript. It uses no server-side application or database. GitHub Actions checks for updates every four hours; actual scheduled execution may be delayed.

## Archive

<!-- archive-stats:start -->
- The archive contains **3899 wallpapers** since **2016-03-05**, including 3899 with thumbnails.
<!-- archive-stats:end -->

The source is Bing's `HPImageArchive` API for `zh-CN`. Categories use keyword classification and a visual model; colors are derived from thumbnails. These labels are automated and may be imperfect.

<details>
<summary>Development and deployment</summary>

Install Python dependencies from `requirements.txt` and JavaScript dependencies from the lockfile. To refresh data and build:

```sh
python3 scripts/download.py
python3 scripts/classify.py
python3 scripts/generate_index.py
python3 scripts/update_readme_stats.py
python3 scripts/check_archive.py
npm run build
```

The local build uses a data snapshot and must be rebuilt after updating data. `npm run test:archive` checks archive-date handling and synchronization safeguards.

### Deployment

The update workflow checks recent Bing records and missing thumbnails, downloads and classifies additions, rebuilds the index and validates the archive before committing. It uses Bing's `startdate` as the archive date and stops on missing or invalid dates. No-change runs avoid unnecessary rebuilding. A report is kept as an Actions artifact, and `data/first-seen.json` records when this checker first observed each image, not Bing's publication time.

Cloudflare Pages hosts the primary site, with a GitHub Pages fallback. See [deployment and rollback](docs/cloudflare-pages.md) and the [Chinese guide](README.zh-CN.md) for workflow and maintenance details.

</details>

## License

See [LICENSE](LICENSE). Wallpaper copyright belongs to its creators and Bing; this project is for archiving and learning.
