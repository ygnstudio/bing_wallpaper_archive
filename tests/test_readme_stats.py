import sys
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import update_readme_stats as stats

INDEX = [
    {'date': '20160305', 'thumbnail': 'old.webp'},
    {'date': '20261008'},
]


class ReadmeStats(unittest.TestCase):
    def test_real_english_readme_preserves_links_and_manual_copy_after_updates(self):
        original = (Path(__file__).resolve().parents[1] / 'README.md').read_text()
        updated = stats.render_stats(original, INDEX)
        self.assertIn('contains **2 wallpapers** since **2016-03-05**, including 1 with thumbnails', updated)
        self.assertEqual(original.split(stats.START)[0], updated.split(stats.START)[0])
        self.assertEqual(original.split(stats.END)[1], updated.split(stats.END)[1])
        self.assertEqual(updated, stats.render_stats(updated, INDEX))

    def test_real_chinese_readme_preserves_links_and_manual_copy_after_updates(self):
        original = (Path(__file__).resolve().parents[1] / 'README.zh-CN.md').read_text()
        updated = stats.render_stats(original, INDEX, lang='zh')
        self.assertIn('收录 **2 张**壁纸，最早可追溯到 **2016-03-05**，其中 1 张含缩略图', updated)
        self.assertEqual(original.split(stats.START)[0], updated.split(stats.START)[0])
        self.assertEqual(original.split(stats.END)[1], updated.split(stats.END)[1])
        self.assertEqual(updated, stats.render_stats(updated, INDEX, lang='zh'))

    def test_main_updates_both_readmes_only_inside_markers(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            english = root / 'README.md'
            chinese = root / 'README.zh-CN.md'
            english.write_text('EN head\n' + stats.START + '\nold\n' + stats.END + '\nEN tail\n', encoding='utf-8')
            chinese.write_text('ZH head\n' + stats.START + '\nold\n' + stats.END + '\nZH tail\n', encoding='utf-8')

            with patch.object(stats, 'README', english), patch.object(stats, 'load_json', return_value=INDEX):
                stats.main()

            en_text = english.read_text(encoding='utf-8')
            zh_text = chinese.read_text(encoding='utf-8')
            self.assertIn('contains **2 wallpapers**', en_text)
            self.assertIn('收录 **2 张**壁纸', zh_text)
            self.assertTrue(en_text.startswith('EN head\n'))
            self.assertTrue(en_text.endswith('EN tail\n'))
            self.assertTrue(zh_text.startswith('ZH head\n'))
            self.assertTrue(zh_text.endswith('ZH tail\n'))

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
