import sys
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import update_readme_stats as stats


class ReadmeStats(unittest.TestCase):
    def test_real_readme_preserves_links_and_manual_copy_after_updates(self):
        original = (Path(__file__).resolve().parents[1] / 'README.md').read_text()
        updated = stats.render_stats(original, [
            {'date': '20160305', 'thumbnail': 'old.webp'},
            {'date': '20261008'},
        ])
        self.assertIn('共 **2 张**壁纸（其中 1 张含缩略图）', updated)
        self.assertEqual(original.split(stats.START)[0], updated.split(stats.START)[0])
        self.assertEqual(original.split(stats.END)[1], updated.split(stats.END)[1])
        self.assertEqual(updated, stats.render_stats(updated, [
            {'date': '20160305', 'thumbnail': 'old.webp'}, {'date': '20261008'},
        ]))

    def test_invalid_markers_and_empty_index_leave_file_unchanged(self):
        cases = [
            ('manual text', [{'date': '20261008'}]),
            (stats.START + stats.START + stats.END, [{'date': '20261008'}]),
            (stats.END + stats.START, [{'date': '20261008'}]),
            (stats.START + stats.END, []),
        ]
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'README.md'
            for text, index in cases:
                with self.subTest(text=text, index=index):
                    path.write_text(text)
                    with patch.object(stats, 'README', path), patch.object(stats, 'load_json', return_value=index):
                        with self.assertRaises(ValueError):
                            stats.main()
                    self.assertEqual(text, path.read_text())


if __name__ == '__main__':
    unittest.main()
